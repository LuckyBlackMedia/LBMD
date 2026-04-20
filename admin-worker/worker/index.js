/**
 * LBM Admin API — Cloudflare Worker
 * Phase 1 + Phase 2
 *
 * Bindings (set in wrangler.toml):
 *   DB       → D1: lbmd-portal-db
 *   SESSIONS → KV: LBMD_SESSIONS
 *   ASSETS   → Static assets (set automatically by Cloudflare Pages)
 *
 * Secrets (set with: wrangler secret put <NAME>):
 *   ADMIN_PASSWORD     — admin login password
 *   RECOVERY_CODE      — offline backup key (e.g. LBM-RCVR-XXXX)
 *   ICLOUD_APPLE_ID    — Phase 2: Apple ID email
 *   ICLOUD_APP_PASSWORD — Phase 2: app-specific password (appleid.apple.com)
 *   RESEND_API_KEY     — Phase 2: email via Resend
 *   ADMIN_EMAIL        — Phase 2: owner email for BCC/CC
 *
 * Routes:
 *   POST   /api/auth/login
 *   POST   /api/auth/logout
 *   POST   /api/auth/change-password   (requires session)
 *
 *   GET    /api/links
 *   POST   /api/links
 *   PUT    /api/links/:id
 *   DELETE /api/links/:id
 *
 *   GET    /api/bookings
 *   POST   /api/bookings               Phase 2: iCloud + email on free path
 *   PUT    /api/bookings/:id
 *   DELETE /api/bookings/:id
 *   POST   /api/bookings/:id/confirm-payment   Phase 2
 *   POST   /api/bookings/:id/cancel            Phase 2
 *
 *   GET    /api/services
 *   POST   /api/services
 *   DELETE /api/services/:id
 *
 *   GET    /api/availability            Phase 2: ?date=YYYY-MM-DD subtracts iCloud busy slots
 *   PUT    /api/availability/:day       (day = 0–6)
 *
 *   POST   /api/discover-calendar      Phase 2: one-time setup, logs ICLOUD_CALENDAR_ID
 */

// ── Phase 2 imports ───────────────────────────────────────────────────────────

import { getICloudBusySlots, createICloudEvent,
         deleteICloudEvent, discoverCalendarUrl } from './helpers/caldav.js';
import { generateICS } from './helpers/ics.js';
import { sendConfirmationEmail, sendReminderEmail,
         sendCancellationEmail } from './helpers/email.js';

// ── Phase 3 imports ───────────────────────────────────────────────────────────

import { squareCharge, paypalGetToken,
         paypalCreateOrder, paypalCaptureOrder } from './helpers/payments.js';

// ── BlackSuite (shared with portal worker) ────────────────────────────────────

import { ensureBlackSuiteSchema } from '../shared/schema.js';
import { Storage }                from '../shared/storage.js';

// ── CONSTANTS ────────────────────────────────────────────────────────────────

const SESSION_PREFIX = 'lbm_admin:';
const SESSION_TTL    = 4 * 60 * 60;   // 4 hours in seconds
const MAX_ATTEMPTS   = 5;
const LOCKOUT_TTL    = 15 * 60;       // 15 minutes in seconds

const ALLOWED_ORIGINS = new Set([
  'https://admin.myluckyblackmedia.com',
  'https://services.myluckyblackmedia.com',
]);

function corsHeaders(request) {
  const origin = request?.headers?.get('origin') || '';
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.has(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        const res = await handleAPI(request, env, url, method);
        const h   = new Headers(res.headers);
        for (const [k, v] of Object.entries(corsHeaders(request))) h.set(k, v);
        return new Response(res.body, { status: res.status, headers: h });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    // services.myluckyblackmedia.com — serve services.html at root
    if (url.hostname === 'services.myluckyblackmedia.com') {
      const assetPath = (url.pathname === '/' || url.pathname === '/index.html')
        ? '/services.html'
        : url.pathname;
      // Fetch the asset from the admin domain (same worker, known working)
      const assetReq = new Request('https://admin.myluckyblackmedia.com' + assetPath + url.search, { method: 'GET' });
      const assetRes = env.ASSETS ? await env.ASSETS.fetch(assetReq) : new Response('Not found', { status: 404 });
      // Return with correct headers, stripping any redirect loops
      return new Response(assetRes.body, {
        status: assetRes.status,
        headers: assetRes.headers,
      });
    }

    // Redirect bare root to admin hub
    if (method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return Response.redirect(new URL('/lbm-admin-hub.html', request.url).toString(), 302);
    }

    // Serve static assets (HTML, CSS, etc.)
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },

  // ── Phase 2: scheduled cron handler (daily reminder emails) ───────────────
  async scheduled(event, env, ctx) {
    try {
      await ensureSchema(env.DB);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const { results } = await env.DB.prepare(
        `SELECT b.*,
                s.name            AS service_name,
                s.duration_min    AS svc_duration_min,
                s.duration        AS svc_duration,
                s.meeting_address AS svc_meeting_address
         FROM admin_bookings b
         LEFT JOIN admin_services s ON b.service_id = s.id
         WHERE b.date = ? AND b.status = 'confirmed'`
      ).bind(tomorrow).all();

      for (const booking of results) {
        const service = {
          name:            booking.service_name        || 'Session',
          duration_min:    booking.svc_duration_min    || booking.svc_duration || 60,
          meeting_address: booking.svc_meeting_address || '',
        };
        // sendReminderEmail - PHASE 2
        await sendReminderEmail(booking, service, env);
      }

      // Phase 3: clean up expired holds
      await env.DB.prepare('DELETE FROM admin_holds WHERE expires_at < ?')
        .bind(Date.now()).run().catch(() => {});
    } catch (err) {
      console.error('scheduled cron error:', err);
    }
  },
};

// ── API ROUTER ───────────────────────────────────────────────────────────────

async function handleAPI(request, env, url, method) {
  const path = url.pathname;

  // ── AUTH: LOGIN (no session required) ──────────────────────────────────────
  if (method === 'POST' && path === '/api/auth/login') {
    const { password } = await request.json().catch(() => ({}));
    if (!password) return json({ ok: false, error: 'Password required.' }, 400);

    // Check lockout (KV key: lbm_admin:lockout)
    const lockoutKey  = SESSION_PREFIX + 'lockout';
    const lockoutData = await env.SESSIONS.get(lockoutKey, { type: 'json' }).catch(() => null);
    if (lockoutData && lockoutData.until > Date.now()) {
      const mins = Math.ceil((lockoutData.until - Date.now()) / 60000);
      return json({ ok: false, error: `Too many attempts. Try again in ${mins} min.`, locked: true }, 429);
    }

    const isValid    = password === env.ADMIN_PASSWORD || password === env.RECOVERY_CODE;
    const isRecovery = password === env.RECOVERY_CODE;

    if (!isValid) {
      // Track attempts
      const attemptsKey  = SESSION_PREFIX + 'attempts';
      const attemptsData = await env.SESSIONS.get(attemptsKey, { type: 'json' }).catch(() => null);
      const attempts     = (attemptsData?.count || 0) + 1;
      const left         = MAX_ATTEMPTS - attempts;

      if (attempts >= MAX_ATTEMPTS) {
        await env.SESSIONS.put(lockoutKey,  JSON.stringify({ until: Date.now() + LOCKOUT_TTL * 1000 }), { expirationTtl: LOCKOUT_TTL });
        await env.SESSIONS.delete(attemptsKey);
        return json({ ok: false, error: `Too many failed attempts. Locked for 15 minutes.`, locked: true }, 429);
      }
      await env.SESSIONS.put(attemptsKey, JSON.stringify({ count: attempts }), { expirationTtl: LOCKOUT_TTL });
      return json({ ok: false, error: `Incorrect code. ${left} attempt${left !== 1 ? 's' : ''} remaining.` }, 401);
    }

    // Clear attempts on success
    await env.SESSIONS.delete(SESSION_PREFIX + 'attempts').catch(() => {});

    const token     = crypto.randomUUID();
    const expiresAt = Date.now() + SESSION_TTL * 1000;
    await env.SESSIONS.put(
      SESSION_PREFIX + token,
      JSON.stringify({ createdAt: Date.now(), expiresAt }),
      { expirationTtl: SESSION_TTL }
    );

    return json({ ok: true, token, expiresAt, recovery: isRecovery });
  }

  // ── Phase 3: PUBLIC BOOKING ROUTES (no session required) ─────────────────────
  // GET /api/services — public so book.html can load the service list
  if (method === 'GET'  && path === '/api/services')
    return publicGetServices(env);
  // GET /api/availability with date_from param → public per-date slot map
  if (method === 'GET'  && path === '/api/availability' && url.searchParams.get('date_from'))
    return publicGetAvailability(url, env);
  if (method === 'POST' && path === '/api/booking/hold')
    return publicHoldSlot(request, env);
  if (method === 'POST' && path === '/api/booking/create')
    return publicCreateBooking(request, env);
  if (method === 'POST' && path === '/api/payment/square')
    return publicPaySquare(request, env);
  if (method === 'POST' && path === '/api/payment/paypal')
    return publicPayPalCreateOrder(request, env);
  if (method === 'POST' && path === '/api/payment/paypal/capture')
    return publicPayPalCapture(request, env);
  if (method === 'GET'  && path === '/api/booking/confirm')
    return publicGetConfirmation(url, env);
  if (method === 'POST' && path === '/api/booking/cancel')
    return publicCancelBooking(request, env);

  // ── PAGE SERVICES — public GET (no session required) ──────────────────────
  if (method === 'GET' && path === '/api/page-services' && url.searchParams.get('all') !== '1')
    return publicGetPageServices(env);

  // ── SESSION VALIDATION ─────────────────────────────────────────────────────
  const token   = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/, '').trim();
  const session = token ? await env.SESSIONS.get(SESSION_PREFIX + token, { type: 'json' }).catch(() => null) : null;
  if (!session || session.expiresAt < Date.now()) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // ── AUTH: LOGOUT ───────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/api/auth/logout') {
    await env.SESSIONS.delete(SESSION_PREFIX + token).catch(() => {});
    return json({ ok: true });
  }

  // ── AUTH: CHANGE PASSWORD ──────────────────────────────────────────────────
  if (method === 'POST' && path === '/api/auth/change-password') {
    const { current, newPassword, confirm } = await request.json().catch(() => ({}));
    if (current !== env.ADMIN_PASSWORD && current !== env.RECOVERY_CODE)
      return json({ ok: false, error: 'Current password incorrect.' }, 400);
    if (!newPassword || newPassword.length < 8)
      return json({ ok: false, error: 'New password must be at least 8 characters.' }, 400);
    if (newPassword !== confirm)
      return json({ ok: false, error: 'Passwords do not match.' }, 400);
    if (newPassword === env.RECOVERY_CODE)
      return json({ ok: false, error: 'Password cannot match your recovery code.' }, 400);
    // Worker Secrets cannot be updated at runtime — instruct via CLI
    return json({
      ok: false,
      error: 'Run: wrangler secret put ADMIN_PASSWORD — then re-deploy to apply the new password.',
    }, 400);
  }

  // Ensure D1 schema on first authenticated request
  await ensureSchema(env.DB);

  // ── Phase 2: DISCOVER CALENDAR (one-time setup) ────────────────────────────
  if (method === 'POST' && path === '/api/discover-calendar') {
    const calendarUrl = await discoverCalendarUrl(env);
    return json({ calendarUrl });
  }

  // ── LINKS ──────────────────────────────────────────────────────────────────
  if (path === '/api/links') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT * FROM admin_links ORDER BY sort_order ASC, id ASC'
      ).all();
      return json(results);
    }
    if (method === 'POST') {
      const { group, icon, label, url: linkUrl, desc } = await request.json();
      if (!label || !linkUrl) return json({ error: 'label and url required' }, 400);
      const r = await env.DB.prepare(
        'INSERT INTO admin_links (group_name, icon, label, url, description, sort_order, created_at) VALUES (?,?,?,?,?,0,?)'
      ).bind(group || '', icon || '🔗', label, linkUrl, desc || '', Date.now()).run();
      const row = await env.DB.prepare('SELECT * FROM admin_links WHERE rowid = ?').bind(r.meta.last_row_id).first();
      return json(row, 201);
    }
  }

  const linkMatch = path.match(/^\/api\/links\/(\d+)$/);
  if (linkMatch) {
    const id = Number(linkMatch[1]);
    if (method === 'PUT') {
      const { group, icon, label, url: linkUrl, desc, sort_order } = await request.json();
      await env.DB.prepare(
        'UPDATE admin_links SET group_name=?, icon=?, label=?, url=?, description=?, sort_order=? WHERE id=?'
      ).bind(group || '', icon || '🔗', label, linkUrl, desc || '', sort_order ?? 0, id).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM admin_links WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }

  // ── SERVICES ───────────────────────────────────────────────────────────────
  if (path === '/api/services') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM admin_services ORDER BY id ASC').all();
      return json(results);
    }
    if (method === 'POST') {
      const { name, duration, price, maxPerDay, desc, meetingAddress } = await request.json();
      if (!name) return json({ error: 'name required' }, 400);
      const durationMin = duration || 60;
      const r = await env.DB.prepare(
        'INSERT INTO admin_services (name, duration, duration_min, price, max_per_day, description, meeting_address, created_at) VALUES (?,?,?,?,?,?,?,?)'
      ).bind(name, durationMin, durationMin, price || 0, maxPerDay || null, desc || '', meetingAddress || '', Date.now()).run();
      const row = await env.DB.prepare('SELECT * FROM admin_services WHERE rowid = ?').bind(r.meta.last_row_id).first();
      return json(row, 201);
    }
  }

  const svcMatch = path.match(/^\/api\/services\/(\d+)$/);
  if (svcMatch && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM admin_services WHERE id = ?').bind(Number(svcMatch[1])).run();
    return json({ ok: true });
  }
  if (svcMatch && method === 'PATCH') {
    const { price } = await request.json().catch(() => ({}));
    if (price === undefined || price < 0) return json({ error: 'price required' }, 400);
    await env.DB.prepare('UPDATE admin_services SET price = ? WHERE id = ?').bind(price, Number(svcMatch[1])).run();
    return json({ ok: true });
  }

  // ── Phase 4: SQUARE SERVICES SYNC ──────────────────────────────────────────
  if (path === '/api/services/sync-square' && method === 'POST') {
    return syncSquareServices(env);
  }

  // ── PAGE SERVICES — admin CRUD ─────────────────────────────────────────────
  if (path === '/api/page-services' && method === 'GET') {
    await ensureSchema(env.DB);
    const { results } = await env.DB.prepare(
      `SELECT id, category, category_num, name, badge, price_display, price_note,
              is_custom, description, bullets, cta_url, sort_order, is_active
       FROM page_services
       ORDER BY category_num ASC, sort_order ASC`
    ).all();
    const groups = [];
    const seen = new Map();
    for (const row of results) {
      let bullets;
      try { bullets = JSON.parse(row.bullets || '[]'); } catch { bullets = []; }
      const card = { ...row, bullets };
      if (!seen.has(row.category_num)) {
        seen.set(row.category_num, { category: row.category, category_num: row.category_num, cards: [] });
        groups.push(seen.get(row.category_num));
      }
      seen.get(row.category_num).cards.push(card);
    }
    return json(groups);
  }
  if (path === '/api/page-services' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { category, category_num, name, badge, price_display, price_note,
            is_custom, description, bullets, cta_url, sort_order } = body;
    if (!name || !category) return json({ error: 'name and category required' }, 400);
    const r = await env.DB.prepare(
      `INSERT INTO page_services (category, category_num, name, badge, price_display, price_note,
       is_custom, description, bullets, cta_url, sort_order, is_active, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?)`
    ).bind(
      category, category_num || 1, name, badge || null, price_display || '',
      price_note || null, is_custom ? 1 : 0, description || '',
      JSON.stringify(bullets || []), cta_url || null, sort_order || 0, Date.now()
    ).run();
    const row = await env.DB.prepare('SELECT * FROM page_services WHERE rowid = ?').bind(r.meta.last_row_id).first();
    return json(row, 201);
  }

  const psSvcMatch = path.match(/^\/api\/page-services\/(\d+)$/);
  if (psSvcMatch) {
    const id = Number(psSvcMatch[1]);
    if (method === 'PATCH') {
      const body = await request.json().catch(() => ({}));
      const allowed = ['category','category_num','name','badge','price_display','price_note',
                       'is_custom','description','bullets','cta_url','sort_order','is_active'];
      const sets = [], vals = [];
      for (const f of allowed) {
        if (body[f] !== undefined) {
          sets.push(`${f} = ?`);
          vals.push(f === 'bullets' ? JSON.stringify(body[f]) : body[f]);
        }
      }
      if (!sets.length) return json({ error: 'no fields to update' }, 400);
      vals.push(id);
      await env.DB.prepare(`UPDATE page_services SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM page_services WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }

  // ── BOOKINGS ───────────────────────────────────────────────────────────────
  if (path === '/api/bookings') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT * FROM admin_bookings ORDER BY date DESC, time DESC'
      ).all();
      return json(results);
    }
    if (method === 'POST') {
      return createBooking(request, env);
    }
  }

  const bkMatch = path.match(/^\/api\/bookings\/(\d+)$/);
  if (bkMatch) {
    const id = Number(bkMatch[1]);
    if (method === 'PUT') {
      const body   = await request.json();
      const fields = ['status', 'notes', 'date', 'time', 'service_id', 'price'];
      const sets = [], vals = [];
      for (const f of fields) {
        if (body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(body[f]); }
      }
      if (sets.length) {
        vals.push(id);
        await env.DB.prepare(`UPDATE admin_bookings SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
      }
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM admin_bookings WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }

  // ── Phase 2: CONFIRM PAYMENT ───────────────────────────────────────────────
  const confirmMatch = path.match(/^\/api\/bookings\/(\d+)\/confirm-payment$/);
  if (confirmMatch && method === 'POST') {
    return confirmPayment(Number(confirmMatch[1]), request, env);
  }

  // ── Phase 2: CANCEL BOOKING ────────────────────────────────────────────────
  const cancelMatch = path.match(/^\/api\/bookings\/(\d+)\/cancel$/);
  if (cancelMatch && method === 'POST') {
    return cancelBooking(Number(cancelMatch[1]), request, env);
  }

  // ── AVAILABILITY ───────────────────────────────────────────────────────────
  if (path === '/api/availability' && method === 'GET') {
    return getAvailability(url, env);
  }

  const availMatch = path.match(/^\/api\/availability\/([0-6])$/);
  if (availMatch && method === 'PUT') {
    const day          = Number(availMatch[1]);
    const { open, slots } = await request.json();
    await env.DB.prepare('UPDATE admin_availability SET open = ?, slots = ? WHERE day = ?')
      .bind(open ? 1 : 0, JSON.stringify(slots || []), day).run();
    return json({ ok: true });
  }

  // ── BLACKSUITE FILE PROXY ────────────────────────────────────────────────
  // Admin-only preview/download of any bs_files row. Client-facing variant
  // with token auth lives in the portal worker. Supports legacy client_files
  // rows (Drive URLs) via Storage.legacyDriveFileFromUrl().
  const bsStreamMatch   = path.match(/^\/api\/bs\/stream\/(\d+)$/);
  const bsDownloadMatch = path.match(/^\/api\/bs\/download\/(\d+)$/);
  if (method === 'GET' && (bsStreamMatch || bsDownloadMatch)) {
    const fileId   = Number((bsStreamMatch || bsDownloadMatch)[1]);
    const isDownload = !!bsDownloadMatch;

    // 1) Try bs_files first.
    let row = await env.DB.prepare(
      'SELECT id, storage_backend, storage_key, label, mime_type FROM bs_files WHERE id = ?',
    ).bind(fileId).first().catch(() => null);

    // 2) Fallback: legacy client_files with a Drive URL.
    if (!row) {
      const legacy = await env.DB.prepare(
        'SELECT id, client_id, label, subtitle, drive_url FROM client_files WHERE id = ?',
      ).bind(fileId).first().catch(() => null);
      if (legacy) {
        const synth = Storage.legacyDriveFileFromUrl(legacy);
        if (synth) row = synth;
      }
    }
    if (!row) return json({ error: 'Not found' }, 404);

    const range        = request.headers.get('range') || undefined;
    const ifNoneMatch  = request.headers.get('if-none-match') || undefined;
    const storage      = new Storage(env);
    const { body, status, headers } = await storage.get(row.storage_key, { range, ifNoneMatch });

    if (row.mime_type && !headers.get('content-type')) {
      headers.set('content-type', row.mime_type);
    }
    if (isDownload) {
      const safeLabel = (row.label || `file-${fileId}`).replace(/["\\\r\n]/g, '_');
      headers.set('content-disposition', `attachment; filename="${safeLabel}"`);
    }
    // Cache: short for previews, none for downloads
    if (!isDownload && !headers.get('cache-control')) {
      headers.set('cache-control', 'private, max-age=60');
    }
    return new Response(body, { status, headers });
  }

  return json({ error: 'Not found' }, 404);
}

// ── Phase 2: getAvailability ──────────────────────────────────────────────────

async function getAvailability(url, env) {
  const { results } = await env.DB.prepare('SELECT * FROM admin_availability ORDER BY day ASC').all();
  const rows = results.map(r => ({ ...r, slots: JSON.parse(r.slots || '[]'), open: !!r.open }));

  // getICloudBusySlots - PHASE 2
  const queryDate = url.searchParams.get('date');
  if (queryDate) {
    const busySlots = await getICloudBusySlots(queryDate, queryDate, env);
    if (busySlots.length > 0) {
      return json(subtractBusy(rows, busySlots, queryDate));
    }
  }

  return json(rows);
}

// Subtract iCloud busy blocks from availability slots for a given date.
// Each slot has { start: "HH:MM", end: "HH:MM" }. We remove any 30-min
// increment that overlaps a busy block (UTC ISO strings).
function subtractBusy(availRows, busySlots, date) {
  if (!busySlots.length) return availRows;

  // Convert busy slots to minute-offsets from midnight UTC on the given date
  const dayStart = new Date(date + 'T00:00:00Z').getTime();
  const busyMins = busySlots.map(b => ({
    start: Math.floor((new Date(b.start).getTime() - dayStart) / 60000),
    end:   Math.ceil ((new Date(b.end  ).getTime() - dayStart) / 60000),
  }));

  return availRows.map(row => {
    if (!row.open || !row.slots.length) return row;

    const filteredSlots = row.slots.filter(slot => {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      const slotStartMin = sh * 60 + sm;
      const slotEndMin   = eh * 60 + em;

      // Remove slot if it fully overlaps any busy block
      return !busyMins.some(b => slotStartMin < b.end && slotEndMin > b.start);
    });

    return { ...row, slots: filteredSlots };
  });
}

// ── Phase 2: createBooking ────────────────────────────────────────────────────

async function createBooking(request, env) {
  const body = await request.json().catch(() => ({}));
  const {
    name, email, date, time, start_time, serviceId, price, status, notes,
    client_phone, meeting_type, meeting_link, timezone_client,
  } = body;

  const startT = start_time || time;
  if (!name || !email || !date || !startT) {
    return json({ error: 'name, email, date, and time/start_time required' }, 400);
  }

  // Generate confirmation code: LBM-XXXX-XXXX
  const confirmation_code = 'LBM-'
    + crypto.randomUUID().slice(0, 4).toUpperCase()
    + '-'
    + crypto.randomUUID().slice(0, 4).toUpperCase();

  const svcPrice  = price ?? 0;
  const isPaid    = svcPrice > 0;
  const bkStatus  = isPaid ? 'pending_payment' : (status || 'confirmed');

  const r = await env.DB.prepare(
    `INSERT INTO admin_bookings
       (name, email, date, time, start_time, service_id, price, status, notes, created_at,
        confirmation_code, client_phone, meeting_type, meeting_link, timezone_client)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    name, email, date, startT, startT,
    serviceId || null, svcPrice, bkStatus, notes || '',
    Date.now(), confirmation_code,
    client_phone || '', meeting_type || 'meet',
    meeting_link || '', timezone_client || 'America/Los_Angeles',
  ).run();

  const booking = await env.DB.prepare('SELECT * FROM admin_bookings WHERE rowid = ?')
    .bind(r.meta.last_row_id).first();

  // For paid bookings: return early — Phase 2 hooks fire after confirmPayment
  if (isPaid) {
    return json({ ...booking, payment_required: true }, 201);
  }

  // Free path Phase 2 hooks
  let service = null;
  if (serviceId) {
    service = await env.DB.prepare('SELECT * FROM admin_services WHERE id = ?')
      .bind(serviceId).first().catch(() => null);
  }
  if (!service) {
    service = { name: 'Session', duration_min: 60, duration: 60, meeting_address: '' };
  }
  // Ensure duration_min is populated
  service.duration_min = service.duration_min || service.duration || 60;

  // createICloudEvent - PHASE 2
  const ev = await createICloudEvent(booking, service, env);
  if (ev.success && ev.eventUid) {
    await env.DB.prepare('UPDATE admin_bookings SET gcal_event_id = ? WHERE id = ?')
      .bind(ev.eventUid, booking.id).run();
    booking.gcal_event_id = ev.eventUid;
  }

  // sendConfirmationEmail - PHASE 2
  await sendConfirmationEmail(booking, service, env);

  return json(booking, 201);
}

// ── Phase 2: confirmPayment ───────────────────────────────────────────────────

async function confirmPayment(id, request, env) {
  const { payment_intent_id } = await request.json().catch(() => ({}));

  const booking = await env.DB.prepare('SELECT * FROM admin_bookings WHERE id = ?')
    .bind(id).first();
  if (!booking) return json({ error: 'Booking not found' }, 404);
  if (booking.status !== 'pending_payment') {
    return json({ error: `Booking status is '${booking.status}', expected 'pending_payment'` }, 409);
  }

  await env.DB.prepare(
    'UPDATE admin_bookings SET status = ?, payment_intent_id = ? WHERE id = ?'
  ).bind('confirmed', payment_intent_id || null, id).run();

  const updated = await env.DB.prepare('SELECT * FROM admin_bookings WHERE id = ?').bind(id).first();

  let service = null;
  if (updated.service_id) {
    service = await env.DB.prepare('SELECT * FROM admin_services WHERE id = ?')
      .bind(updated.service_id).first().catch(() => null);
  }
  if (!service) {
    service = { name: 'Session', duration_min: 60, duration: 60, meeting_address: '' };
  }
  service.duration_min = service.duration_min || service.duration || 60;

  // createICloudEvent paid - PHASE 2
  const ev = await createICloudEvent(updated, service, env);
  if (ev.success && ev.eventUid) {
    await env.DB.prepare('UPDATE admin_bookings SET gcal_event_id = ? WHERE id = ?')
      .bind(ev.eventUid, id).run();
    updated.gcal_event_id = ev.eventUid;
  }

  // sendConfirmationEmail - PHASE 2
  await sendConfirmationEmail(updated, service, env);

  return json({ ok: true, confirmation_code: updated.confirmation_code });
}

// ── Phase 2: cancelBooking ────────────────────────────────────────────────────

async function cancelBooking(id, request, env) {
  const body   = await request.json().catch(() => ({}));
  const choice = body.choice || 'credit'; // 'refund' | 'credit'

  const booking = await env.DB.prepare('SELECT * FROM admin_bookings WHERE id = ?')
    .bind(id).first();
  if (!booking) return json({ error: 'Booking not found' }, 404);

  let service = null;
  if (booking.service_id) {
    service = await env.DB.prepare('SELECT * FROM admin_services WHERE id = ?')
      .bind(booking.service_id).first().catch(() => null);
  }
  if (!service) {
    service = { name: 'Session', duration_min: 60, duration: 60, meeting_address: '' };
  }
  service.duration_min = service.duration_min || service.duration || 60;

  // Refund eligibility: 4+ hours before session
  const startTime    = booking.start_time || booking.time || '09:00';
  const sessionMs    = new Date(booking.date + 'T' + startTime + ':00Z').getTime();
  const hoursUntil   = (sessionMs - Date.now()) / 3600000;
  const refundAmount = hoursUntil >= 4 ? Math.round(booking.price * 0.97 * 100) / 100 : 0;

  // Generate rebook credit code if applicable
  let creditCode = null;
  if (choice === 'credit' && booking.price > 0) {
    creditCode = 'LBM-CREDIT-'
      + crypto.randomUUID().slice(0, 6).toUpperCase();
    const ONE_YEAR = 365 * 24 * 60 * 60;
    await env.SESSIONS.put(
      SESSION_PREFIX + 'credit:' + creditCode,
      JSON.stringify({
        booking_id:      id,
        original_amount: booking.price,
        created_at:      Date.now(),
      }),
      { expirationTtl: ONE_YEAR }
    );
  }

  // deleteICloudEvent - PHASE 2
  await deleteICloudEvent(id, env);

  await env.DB.prepare('UPDATE admin_bookings SET status = ? WHERE id = ?')
    .bind('cancelled', id).run();

  // sendCancellationEmail - PHASE 2
  await sendCancellationEmail(booking, service, choice, refundAmount, creditCode, env);

  return json({ ok: true, choice, refundAmount, creditCode });
}

// ── SCHEMA ────────────────────────────────────────────────────────────────────

let _schemaReady = false;

async function ensureSchema(db) {
  if (_schemaReady) return;

  // Create tables — use prepare().run() for single-statement DDL (D1 exec can choke on template literals)
  const createTables = [
    "CREATE TABLE IF NOT EXISTS admin_links (id INTEGER PRIMARY KEY AUTOINCREMENT, group_name TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '', label TEXT NOT NULL, url TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', featured INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER)",
    "CREATE TABLE IF NOT EXISTS admin_services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, duration INTEGER NOT NULL DEFAULT 60, price REAL NOT NULL DEFAULT 0, max_per_day INTEGER, description TEXT NOT NULL DEFAULT '', created_at INTEGER)",
    "CREATE TABLE IF NOT EXISTS admin_bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, service_id INTEGER, price REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', notes TEXT NOT NULL DEFAULT '', created_at INTEGER)",
    "CREATE TABLE IF NOT EXISTS admin_availability (day INTEGER PRIMARY KEY, open INTEGER NOT NULL DEFAULT 1, slots TEXT NOT NULL DEFAULT '[]')",
  ];
  for (const sql of createTables) {
    try { await db.prepare(sql).run(); } catch (_) { /* table already exists */ }
  }

  // Phase 2: add new columns (SQLite ignores duplicate-column errors via try/catch)
  const p2Cols = [
    'ALTER TABLE admin_bookings ADD COLUMN confirmation_code   TEXT',
    'ALTER TABLE admin_bookings ADD COLUMN gcal_event_id       TEXT',
    'ALTER TABLE admin_bookings ADD COLUMN client_phone        TEXT NOT NULL DEFAULT ""',
    'ALTER TABLE admin_bookings ADD COLUMN meeting_type        TEXT NOT NULL DEFAULT "meet"',
    'ALTER TABLE admin_bookings ADD COLUMN meeting_link        TEXT NOT NULL DEFAULT ""',
    'ALTER TABLE admin_bookings ADD COLUMN timezone_client     TEXT NOT NULL DEFAULT "America/Los_Angeles"',
    'ALTER TABLE admin_bookings ADD COLUMN start_time          TEXT',
    'ALTER TABLE admin_bookings ADD COLUMN payment_intent_id   TEXT',
    'ALTER TABLE admin_bookings ADD COLUMN refund_code         TEXT',
    'ALTER TABLE admin_services ADD COLUMN duration_min        INTEGER NOT NULL DEFAULT 60',
    'ALTER TABLE admin_services ADD COLUMN meeting_address     TEXT    NOT NULL DEFAULT ""',
    'ALTER TABLE admin_services ADD COLUMN square_item_id      TEXT',
  ];
  for (const stmt of p2Cols) {
    try { await db.prepare(stmt).run(); } catch (_) { /* column already exists — safe to ignore */ }
  }

  // Phase 3: holds table + how_heard column
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS admin_holds (id TEXT PRIMARY KEY, session_token TEXT NOT NULL, service_id INTEGER, date TEXT NOT NULL, start_time TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)").run();
  } catch (_) { /* already exists */ }

  // Services page: page_services table
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS page_services (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      category      TEXT    NOT NULL DEFAULT '',
      category_num  INTEGER NOT NULL DEFAULT 1,
      name          TEXT    NOT NULL,
      badge         TEXT    DEFAULT NULL,
      price_display TEXT    NOT NULL DEFAULT '',
      price_note    TEXT    DEFAULT NULL,
      is_custom     INTEGER NOT NULL DEFAULT 0,
      description   TEXT    NOT NULL DEFAULT '',
      bullets       TEXT    NOT NULL DEFAULT '[]',
      cta_url       TEXT    DEFAULT NULL,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    INTEGER
    )`).run();
  } catch (_) { /* already exists */ }

  const p3Cols = [
    'ALTER TABLE admin_bookings ADD COLUMN how_heard TEXT NOT NULL DEFAULT ""',
    'ALTER TABLE admin_bookings ADD COLUMN square_payment_id TEXT',
    'ALTER TABLE admin_bookings ADD COLUMN paypal_order_id TEXT',
  ];
  for (const stmt of p3Cols) {
    try { await db.prepare(stmt).run(); } catch (_) { /* column already exists — safe to ignore */ }
  }

  // Seed availability if empty
  const avail = await db.prepare('SELECT COUNT(*) AS c FROM admin_availability').first();
  if (!avail || avail.c === 0) {
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO admin_availability VALUES (?,?,?)').bind(0, 1, '[{"start":"10:00","end":"17:00","note":"Weekend"}]'),
      db.prepare('INSERT OR IGNORE INTO admin_availability VALUES (?,?,?)').bind(1, 1, '[{"start":"07:00","end":"08:30","note":"Before work"},{"start":"12:00","end":"13:00","note":"Lunch"},{"start":"18:00","end":"21:00","note":"Evening"}]'),
      db.prepare('INSERT OR IGNORE INTO admin_availability VALUES (?,?,?)').bind(2, 1, '[{"start":"07:00","end":"08:30","note":"Before work"},{"start":"12:00","end":"13:00","note":"Lunch"},{"start":"18:00","end":"21:00","note":"Evening"}]'),
      db.prepare('INSERT OR IGNORE INTO admin_availability VALUES (?,?,?)').bind(3, 1, '[{"start":"07:00","end":"08:30","note":"Before work"},{"start":"12:00","end":"13:00","note":"Lunch"},{"start":"18:00","end":"21:00","note":"Evening"}]'),
      db.prepare('INSERT OR IGNORE INTO admin_availability VALUES (?,?,?)').bind(4, 1, '[{"start":"07:00","end":"08:30","note":"Before work"},{"start":"12:00","end":"13:00","note":"Lunch"},{"start":"18:00","end":"21:00","note":"Evening"}]'),
      db.prepare('INSERT OR IGNORE INTO admin_availability VALUES (?,?,?)').bind(5, 1, '[{"start":"07:00","end":"08:30","note":"Before work"},{"start":"12:00","end":"13:00","note":"Lunch"},{"start":"18:00","end":"21:00","note":"Evening"}]'),
      db.prepare('INSERT OR IGNORE INTO admin_availability VALUES (?,?,?)').bind(6, 1, '[{"start":"09:00","end":"18:00","note":"Weekend"}]'),
    ]);
  }

  // Seed default services if empty
  const svcCount = await db.prepare('SELECT COUNT(*) AS c FROM admin_services').first();
  if (!svcCount || svcCount.c === 0) {
    const now = Date.now();
    await db.batch([
      db.prepare('INSERT INTO admin_services (name,duration,duration_min,price,max_per_day,description,meeting_address,created_at) VALUES (?,?,?,?,?,?,?,?)').bind('Free Discovery Call',    30,  30,  0,   3, 'Initial consultation to discuss your project needs.',          '', now),
      db.prepare('INSERT INTO admin_services (name,duration,duration_min,price,max_per_day,description,meeting_address,created_at) VALUES (?,?,?,?,?,?,?,?)').bind('Brand Strategy Session', 90,  90,  350, 2, 'Deep-dive brand strategy and positioning session.',            '', now),
      db.prepare('INSERT INTO admin_services (name,duration,duration_min,price,max_per_day,description,meeting_address,created_at) VALUES (?,?,?,?,?,?,?,?)').bind('Content Creation Day',   480, 480, 800, 1, 'Full-day content capture and production session.',             '', now),
      db.prepare('INSERT INTO admin_services (name,duration,duration_min,price,max_per_day,description,meeting_address,created_at) VALUES (?,?,?,?,?,?,?,?)').bind('Social Media Audit',     60,  60,  150, 4, 'Comprehensive audit of your social media presence.',           '', now),
    ]);
  }

  // Seed default links if empty
  const linkCount = await db.prepare('SELECT COUNT(*) AS c FROM admin_links').first();
  if (!linkCount || linkCount.c === 0) {
    const now = Date.now();
    await db.batch([
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Booking & Clients',  '📅', 'Booking Admin',        'lbm-booking-admin.html',                                 'Manage bookings, availability & clients',          0,  now),
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Hosting & Dev',      '☁️', 'Cloudflare Dashboard', 'https://dash.cloudflare.com',                            'Workers, D1, DNS, analytics & Pages',              1,  now),
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Hosting & Dev',      '🗄️', 'Cloudflare D1',        'https://dash.cloudflare.com/?to=/:account/workers/d1',  'Manage D1 SQLite databases',                       2,  now),
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Hosting & Dev',      '⚡', 'Workers & Pages',      'https://dash.cloudflare.com/?to=/:account/workers',     'Deploy and manage Worker scripts',                 3,  now),
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Payments & Finance', '💳', 'Stripe Dashboard',     'https://dashboard.stripe.com',                          'Payments, subscriptions & invoices',               4,  now),
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Payments & Finance', '🟦', 'Square Dashboard',     'https://squareup.com/dashboard',                        'POS, payments & Square transactions',              5,  now),
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Payments & Finance', '🅿️', 'PayPal Business',      'https://business.paypal.com/home',                      'PayPal transactions & business tools',             6,  now),
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Freelance & Work',   '💼', 'Upwork Dashboard',     'https://www.upwork.com/freelancers/settings',           'Proposals, contracts & earnings',                  7,  now),
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Assets & Brand',     '📁', 'Google Drive',         'https://drive.google.com',                              'Assets, documents & cloud files',                  8,  now),
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Assets & Brand',     '🎨', 'LBM Brand Kit',        '#brand-kit-placeholder',                                'Lucky Black Media brand guidelines & assets',      9,  now),
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Marketing & Social', '📊', 'Google Analytics',     'https://analytics.google.com',                          'Site traffic & user analytics',                    10, now),
      db.prepare('INSERT INTO admin_links (group_name,icon,label,url,description,sort_order,created_at) VALUES (?,?,?,?,?,?,?)').bind('Marketing & Social', '📧', 'Gmail',                'https://mail.google.com',                               'Email & client communications',                    11, now),
    ]);
  }

  // Seed page_services if empty
  const psCount = await db.prepare('SELECT COUNT(*) AS c FROM page_services').first().catch(() => ({ c: 0 }));
  if (!psCount || psCount.c === 0) {
    const now = Date.now();
    const ins = (cat, catNum, name, badge, priceDisplay, priceNote, isCustom, desc, bullets, sortOrder) =>
      db.prepare(`INSERT INTO page_services (category,category_num,name,badge,price_display,price_note,is_custom,description,bullets,sort_order,is_active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`)
        .bind(cat, catNum, name, badge, priceDisplay, priceNote, isCustom?1:0, desc, JSON.stringify(bullets), sortOrder, now);
    await db.batch([
      // 01 Brand Identity
      ins('Brand Identity',1,'Brand Foundation',null,'from $1,500',null,0,'Logo suite, color palette, typography system, and brand guidelines. Built for clarity and authority.',['Primary logo + alternates','Color palette (hex, CMYK, Pantone)','Typography system (2 font pairings)','Brand guidelines PDF','Social media kit'],0),
      ins('Brand Identity',1,'Brand Build','Most Popular','from $2,800',null,0,'Full identity system with expanded logo suite, pattern library, and complete social media kit.',['Everything in Brand Foundation','Expanded logo suite (5+ marks)','Pattern / texture library','Full social media kit (10 templates)','Brand voice overview'],1),
      ins('Brand Identity',1,'Full Brand Build','Best Value','from $4,500',null,0,'Complete brand identity + social media system + campaign starter kit. The full LBM treatment.',['Everything in Brand Build','Campaign starter graphics (6 pieces)','Email header template','Stationery suite (card, letterhead)','Priority turnaround'],2),
      // 02 Social Media
      ins('Social Media Design',2,'À La Carte Graphics',null,'from $75',null,0,'Individual social graphics — carousels, story sets, event flyers. Luxury design, fast delivery.',['Carousel (3–5 slides) — $125','Story Set (3 frames) — $75','Event Flyer (digital) — $175','Print add-on — +$65','Caption pack add-on — +$55'],0),
      ins('Social Media Design',2,'Campaign Packages','Best Value','from $399',null,0,'7, 14, or 30-day content campaigns. Feed posts, story graphics, captions, and scheduling included.',['The Launch (7 days) — $399','The Push (14 days) — $650','The Presence (30 days) — $1,050','Captions + hashtags included','Scheduled for you'],1),
      ins('Social Media Design',2,'Monthly Retainers',null,'from $650/mo',null,0,'Recurring monthly social media design. Essential, Growth, and Signature tiers available.',['Essential — 4 posts + 8 stories/mo — $650','Growth — 8 posts + 12 stories/mo — $950','Signature — 12 posts + 20 stories/mo — $1,450','Captions + hashtags included','Scheduled weekly'],2),
      // 03 Print & Events
      ins('Print & Events',3,'Event Flyer',null,'$175','print add-on +$65',0,'Luxury event flyer with 2 revisions. IG post + story sizing included. Print-safe version available.',['Luxury digital flyer design','2 revision rounds','IG post + story sizing','Print version add-on (+$65)','Full copy bundle add-on (+$75)'],0),
      ins('Print & Events',3,'Branded Print Materials',null,'Custom Quote',null,1,'Business cards, programs, one-sheets, and branded event collateral. Custom pricing by scope.',['Business card design','Program or one-sheet','Branded event collateral','CMYK print-ready export','Rush available (+35%)'],1),
      // 04 Digital Campaigns
      ins('Digital Campaigns',4,'QR & Digital Setups',null,'from $25',null,0,'Branded QR codes, campaign graphics, email headers, and promotional digital assets.',['Branded QR code setup — $25','Email header template — $95','Promo pack (3 graphics) — $199','Newsletter template — $145','Campaign bundle pricing available'],0),
      // 05 Sponsor Decks
      ins('Sponsor Decks',5,'Sponsor Deck — Lite',null,'$450','6–8 slides',0,'A concise, high-impact sponsorship pitch deck. Ideal for emerging brands and first-time outreach.',['6–8 slide deck','2 revision rounds','Brand-matched design','PDF + presentation export','7 business day turnaround'],0),
      ins('Sponsor Decks',5,'Sponsor Deck — Signature','Most Popular','$850','10–12 slides',0,'The definitive LBM sponsor deck. Tier breakdowns, audience data, and brand storytelling built in.',['10–12 slide deck','3 revision rounds','Tier + ROI breakdown','Audience analytics section','5 business day turnaround'],1),
      ins('Sponsor Decks',5,'Sponsor Deck — Premium',null,'$1,350','15–18 slides',0,'Full brand partnership deck — multi-tier offers, case studies, and custom graphics throughout.',['15–18 slide deck','Unlimited revisions (3 rounds)','Custom infographics + case studies','Multiple brand tier layouts','Priority 3 business day turnaround'],2),
      // 06 Photography
      ins('Photography',6,'Events & Portraits',null,'$450/hr','3-hr minimum · from $1,350',0,'Professional photography coverage for events, parties, weddings, and portrait sessions. Client is responsible for location and studio rental fees — not included in pricing.',['Event + portrait coverage','3-hour minimum','Edited high-res digital files','Online gallery delivery','Location/studio fees not included'],0),
      ins('Photography',6,'Headshots',null,'$450','up to 1 hour',0,'Professional headshot session up to 1 hour. Client is responsible for location and studio rental fees — not included in pricing.',['Up to 1-hour session','Edited high-res selects','Online gallery delivery','Multiple looks encouraged','Location/studio fees not included'],1),
      ins('Photography',6,'Brand & Commercial',null,'Custom Quote',null,1,'Professional photography for brands, businesses, products, and marketing campaigns. Custom pricing by scope, deliverables, and usage rights.',['Brand + product photography','Custom scope + deliverables','Usage rights negotiated','Commercial licensing available','Location/studio fees not included'],2),
      ins('Photography',6,'Non-Profit Rate',null,'Custom Quote',null,1,'Discounted photography for registered non-profit organizations. Assessed case-by-case based on mission and project scope.',['For registered non-profits only','Assessed case-by-case','Full photography coverage','Edited digital files delivered','Location/studio fees not included'],3),
      // 07 Videography
      ins('Videography',7,'Events',null,'$550/hr','3-hr minimum · from $1,650',0,'Professional video coverage for events, parties, weddings, and celebrations. Client is responsible for location and studio rental fees — not included in pricing.',['Event video coverage','3-hour minimum','Edited highlight video','Raw footage available','Location/studio fees not included'],0),
      ins('Videography',7,'Brand & Commercial',null,'Custom Quote',null,1,'Professional video production for brands, businesses, and marketing campaigns. Custom pricing by scope, deliverables, and usage rights.',['Brand + commercial video','Custom scope + deliverables','Usage rights negotiated','Multiple deliverable formats','Location/studio fees not included'],1),
      ins('Videography',7,'Non-Profit Rate',null,'Custom Quote',null,1,'Discounted videography for registered non-profit organizations. Assessed case-by-case.',['For registered non-profits only','Assessed case-by-case','Full video coverage','Edited deliverables included','Location/studio fees not included'],2),
      // 08 Photo + Video Combo
      ins('Photo + Video',8,'Events Combo','Best Value','$850/hr','3-hr minimum · from $2,550 · Save $150/hr vs. booking separately',0,'Full photo and video coverage for events, parties, and weddings. Client is responsible for location and studio rental fees — not included in pricing.',['Photo + video event coverage','3-hour minimum','Edited photos + highlight video','Online gallery + video delivery','Location/studio fees not included'],0),
      ins('Photo + Video',8,'Brand & Commercial Combo',null,'Custom Quote',null,1,'Combined photo and video production for brands, businesses, and marketing campaigns. Custom pricing by scope, deliverables, and usage rights.',['Photo + video production','Custom scope + deliverables','Usage rights negotiated','Multiple deliverable formats','Location/studio fees not included'],1),
      ins('Photo + Video',8,'Non-Profit Rate',null,'Custom Quote',null,1,'Discounted photo and video combo for registered non-profit organizations. Assessed case-by-case.',['For registered non-profits only','Assessed case-by-case','Photo + video coverage','All deliverables included','Location/studio fees not included'],2),
    ]);
  }

  // BlackSuite tables — delegated to the shared module so admin + portal
  // stay in lockstep. Idempotent.
  await ensureBlackSuiteSchema(db);

  _schemaReady = true;
}

// ── Phase 3: PUBLIC HANDLERS ──────────────────────────────────────────────────

// Convert a local HH:MM time in the admin's timezone to UTC HH:MM.
// Used to translate stored availability slot times (admin local) to UTC for the public API.
function adminLocalToUTC(dateStr, hhMM, tz) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m]     = hhMM.split(':').map(Number);
  const naiveUTC   = new Date(Date.UTC(y, mo - 1, d, h, m, 0));
  try {
    const fmt   = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = fmt.formatToParts(naiveUTC);
    const lh    = Number(parts.find(p => p.type === 'hour')?.value   ?? h);
    const lm    = Number(parts.find(p => p.type === 'minute')?.value ?? m);
    let diff    = h * 60 + m - (lh * 60 + lm);
    if (diff > 720)  diff -= 1440;
    if (diff < -720) diff += 1440;
    const utc = new Date(naiveUTC.getTime() + diff * 60000);
    return `${String(utc.getUTCHours()).padStart(2,'0')}:${String(utc.getUTCMinutes()).padStart(2,'0')}`;
  } catch {
    return hhMM; // fallback: treat stored time as UTC
  }
}

// Rate limit check via KV. Returns true if request should be blocked.
async function isRateLimited(action, request, env, maxPerHour) {
  try {
    const ip  = request.headers.get('CF-Connecting-IP') || 'unknown';
    const hr  = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
    const key = `lbm_rl:${action}:${ip}:${hr}`;
    const n   = Number(await env.SESSIONS.get(key) || 0);
    if (n >= maxPerHour) return true;
    await env.SESSIONS.put(key, String(n + 1), { expirationTtl: 3600 });
    return false;
  } catch {
    return false; // don't block if KV fails
  }
}

// Shared booking context builder (used by all three payment paths)
function buildBookingPayload(body, hold) {
  return {
    name:             body.client_name  || hold?.client_name  || '',
    email:            body.client_email || hold?.client_email || '',
    date:             body.date         || hold?.date         || '',
    time:             body.start_time   || hold?.start_time   || '',
    start_time:       body.start_time   || hold?.start_time   || '',
    service_id:       body.service_id   ?? hold?.service_id   ?? null,
    notes:            body.notes        || '',
    how_heard:        body.how_heard    || '',
    client_phone:     body.client_phone || '',
    meeting_type:     'meet',           // default; overridden by service row
    meeting_link:     '',
    timezone_client:  body.timezone_client || 'America/Los_Angeles',
    confirmation_code: 'LBM-'
      + crypto.randomUUID().slice(0, 4).toUpperCase() + '-'
      + crypto.randomUUID().slice(0, 4).toUpperCase(),
  };
}

// Validate a hold from D1. Returns { valid, hold, error }.
async function validateHold(holdId, sessionToken, db) {
  if (!holdId || !sessionToken) return { valid: false, error: 'hold_id and session_token required' };
  const hold = await db.prepare(
    'SELECT * FROM admin_holds WHERE id = ? AND session_token = ?'
  ).bind(holdId, sessionToken).first().catch(() => null);
  if (!hold)                          return { valid: false, error: 'Invalid hold' };
  if (hold.expires_at < Date.now())   return { valid: false, error: 'Hold has expired — please select a new time' };
  return { valid: true, hold };
}

// Insert a booking row and fire Phase 2 side-effects (iCloud + email).
async function insertAndNotify(p, service, db, env) {
  const r = await db.prepare(
    `INSERT INTO admin_bookings
       (name, email, date, time, start_time, service_id, price, status, notes,
        created_at, confirmation_code, client_phone, meeting_type, meeting_link,
        timezone_client, how_heard)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    p.name, p.email, p.date, p.time, p.start_time,
    p.service_id, p.price ?? 0, p.status ?? 'confirmed', p.notes,
    Date.now(), p.confirmation_code,
    p.client_phone, service?.meeting_type || 'meet',
    service?.meeting_link || '', p.timezone_client, p.how_heard,
  ).run();

  const booking = await db.prepare('SELECT * FROM admin_bookings WHERE rowid = ?')
    .bind(r.meta.last_row_id).first();

  // iCloud event - PHASE 2
  const ev = await createICloudEvent(booking, service, env);
  if (ev.success && ev.eventUid) {
    await db.prepare('UPDATE admin_bookings SET gcal_event_id = ? WHERE id = ?')
      .bind(ev.eventUid, booking.id).run();
    booking.gcal_event_id = ev.eventUid;
  }

  // Confirmation email - PHASE 2
  await sendConfirmationEmail(booking, service, env);

  return booking;
}

// ── GET /api/services (public) ────────────────────────────────────────────────

async function publicGetServices(env) {
  await ensureSchema(env.DB);
  const { results } = await env.DB.prepare('SELECT * FROM admin_services ORDER BY id ASC').all();
  return json(results);
}

// ── GET /api/page-services (public) — grouped by category ────────────────────

async function publicGetPageServices(env) {
  await ensureSchema(env.DB);
  const { results } = await env.DB.prepare(
    `SELECT id, category, category_num, name, badge, price_display, price_note,
            is_custom, description, bullets, cta_url, sort_order
     FROM page_services
     WHERE is_active = 1
     ORDER BY category_num ASC, sort_order ASC`
  ).all();

  // Group by category
  const groups = [];
  const seen   = new Map();
  for (const row of results) {
    let bullets;
    try { bullets = JSON.parse(row.bullets || '[]'); } catch { bullets = []; }
    const card = { ...row, bullets };

    if (!seen.has(row.category_num)) {
      seen.set(row.category_num, { category: row.category, category_num: row.category_num, cards: [] });
      groups.push(seen.get(row.category_num));
    }
    seen.get(row.category_num).cards.push(card);
  }
  return json(groups);
}

// ── GET /api/availability?date_from=&date_to=&service_id= ────────────────────

async function publicGetAvailability(url, env) {
  const dateFrom  = url.searchParams.get('date_from');
  const dateTo    = url.searchParams.get('date_to');
  const serviceId = url.searchParams.get('service_id');

  if (!dateFrom || !dateTo) return json({ error: 'date_from and date_to required' }, 400);

  // Cap range at 62 days to prevent abuse
  const fromMs = new Date(dateFrom + 'T00:00:00Z').getTime();
  const toMs   = new Date(dateTo   + 'T00:00:00Z').getTime();
  if (toMs - fromMs > 62 * 86400000) return json({ error: 'Date range too large (max 62 days)' }, 400);

  await ensureSchema(env.DB);

  // 1. Weekly availability pattern
  const { results: avail } = await env.DB.prepare(
    'SELECT * FROM admin_availability ORDER BY day ASC'
  ).all();
  const availByDow = {};
  for (const row of avail) {
    availByDow[row.day] = { open: !!row.open, slots: JSON.parse(row.slots || '[]') };
  }

  // 2. Service duration
  let serviceDuration = 60;
  if (serviceId) {
    const svc = await env.DB.prepare('SELECT * FROM admin_services WHERE id = ?')
      .bind(Number(serviceId)).first().catch(() => null);
    if (svc) serviceDuration = svc.duration_min || svc.duration || 60;
  }

  // 3. Existing bookings in range (confirmed or pending payment)
  const { results: bookings } = await env.DB.prepare(
    `SELECT b.date,
            COALESCE(b.start_time, b.time) AS st,
            COALESCE(s.duration_min, s.duration, 60) AS dur
     FROM admin_bookings b
     LEFT JOIN admin_services s ON b.service_id = s.id
     WHERE b.date >= ? AND b.date <= ?
       AND b.status IN ('confirmed','pending_payment')`
  ).bind(dateFrom, dateTo).all();

  // 4. Active holds in range
  await env.DB.prepare('DELETE FROM admin_holds WHERE expires_at < ?').bind(Date.now()).run().catch(() => {});
  const { results: holds } = await env.DB.prepare(
    'SELECT date, start_time FROM admin_holds WHERE date >= ? AND date <= ? AND expires_at > ?'
  ).bind(dateFrom, dateTo, Date.now()).all();

  // 5. Build blocked ranges per date: [{s: startMin, e: endMin}]
  const blocked = {};
  const block = (date, hhMM, dur) => {
    if (!blocked[date]) blocked[date] = [];
    const [h, m] = hhMM.split(':').map(Number);
    const s = h * 60 + m;
    blocked[date].push({ s, e: s + dur });
  };
  for (const bk of bookings) block(bk.date, (bk.st || '00:00').slice(0, 5), bk.dur);
  for (const h  of holds)    block(h.date,   h.start_time.slice(0, 5), serviceDuration);

  // 6. iCloud busy slots
  if (env.ICLOUD_CALENDAR_ID) {
    const busy = await getICloudBusySlots(dateFrom, dateTo, env);
    for (const b of busy) {
      const d        = b.start.slice(0, 10);
      const startMin = new Date(b.start).getUTCHours() * 60 + new Date(b.start).getUTCMinutes();
      const endMin   = new Date(b.end  ).getUTCHours() * 60 + new Date(b.end  ).getUTCMinutes();
      if (!blocked[d]) blocked[d] = [];
      blocked[d].push({ s: startMin, e: endMin });
    }
  }

  // 7. Generate per-date slot arrays
  const adminTz  = env.TIMEZONE_ADMIN || 'America/Los_Angeles';
  const todayUTC = new Date().toISOString().slice(0, 10);
  const nowUTCMin = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();

  const result   = {};
  let   cursor   = new Date(dateFrom + 'T00:00:00Z');
  const endDate  = new Date(dateTo   + 'T00:00:00Z');

  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dow     = cursor.getUTCDay();
    const day     = availByDow[dow];

    if (day?.open && day.slots.length) {
      const slots = [];
      for (const range of day.slots) {
        // Convert admin-local start/end to UTC minutes
        const startUTC = adminLocalToUTC(dateStr, range.start, adminTz);
        const endUTC   = adminLocalToUTC(dateStr, range.end,   adminTz);
        const [sh, sm] = startUTC.split(':').map(Number);
        const [eh, em] = endUTC.split(':').map(Number);
        const rangeStart = sh * 60 + sm;
        const rangeEnd   = eh * 60 + em;

        for (let t = rangeStart; t + serviceDuration <= rangeEnd; t += 30) {
          // Skip slots in the past (add 30-min buffer for today)
          if (dateStr === todayUTC && t < nowUTCMin + 30) continue;

          // Check conflicts
          const hh  = String(Math.floor(t / 60)).padStart(2, '0');
          const mm  = String(t % 60).padStart(2, '0');
          const slotStr = `${hh}:${mm}`;
          const clash = (blocked[dateStr] || []).some(b => t < b.e && t + serviceDuration > b.s);
          if (!clash) slots.push(slotStr);
        }
      }
      if (slots.length) result[dateStr] = slots;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return json(result);
}

// ── POST /api/booking/hold ───────────────────────────────────────────────────

async function publicHoldSlot(request, env) {
  if (await isRateLimited('hold', request, env, 10)) {
    return json({ error: 'Too many requests — please try again later.' }, 429);
  }

  const { service_id, date, start_time } = await request.json().catch(() => ({}));
  if (!date || !start_time) return json({ error: 'date and start_time required' }, 400);

  await ensureSchema(env.DB);

  // Clean expired holds first
  await env.DB.prepare('DELETE FROM admin_holds WHERE expires_at < ?').bind(Date.now()).run().catch(() => {});

  // Check the slot isn't already booked or held
  const dur = service_id
    ? (await env.DB.prepare('SELECT COALESCE(duration_min, duration, 60) AS d FROM admin_services WHERE id = ?')
        .bind(Number(service_id)).first().catch(() => null))?.d ?? 60
    : 60;

  const [slotH, slotM] = start_time.split(':').map(Number);
  const slotStart = slotH * 60 + slotM;
  const slotEnd   = slotStart + dur;

  // Active bookings conflict?
  const { results: conflicts } = await env.DB.prepare(
    `SELECT COALESCE(start_time, time) AS st,
            COALESCE(s.duration_min, s.duration, 60) AS d
     FROM admin_bookings b
     LEFT JOIN admin_services s ON b.service_id = s.id
     WHERE b.date = ? AND b.status IN ('confirmed','pending_payment')`
  ).bind(date).all();

  for (const c of conflicts) {
    const [ch, cm] = (c.st || '00:00').slice(0, 5).split(':').map(Number);
    const cs = ch * 60 + cm;
    if (slotStart < cs + c.d && slotEnd > cs) {
      return json({ error: 'That slot is no longer available.' }, 409);
    }
  }

  // Active holds conflict?
  const { results: heldConflicts } = await env.DB.prepare(
    `SELECT start_time FROM admin_holds WHERE date = ? AND expires_at > ?`
  ).bind(date, Date.now()).all();

  for (const h of heldConflicts) {
    const [hh, hm] = h.start_time.slice(0, 5).split(':').map(Number);
    const hs = hh * 60 + hm;
    if (slotStart < hs + dur && slotEnd > hs) {
      return json({ error: 'That slot is temporarily held by another user. Try again in a few minutes.' }, 409);
    }
  }

  // Create the hold
  const holdId       = crypto.randomUUID();
  const sessionToken = crypto.randomUUID();
  const expiresAt    = Date.now() + 5 * 60 * 1000; // 5 minutes

  await env.DB.prepare(
    'INSERT INTO admin_holds (id, session_token, service_id, date, start_time, expires_at, created_at) VALUES (?,?,?,?,?,?,?)'
  ).bind(holdId, sessionToken, service_id || null, date, start_time, expiresAt, Date.now()).run();

  return json({
    hold_id:       holdId,
    session_token: sessionToken,
    expires_at:    new Date(expiresAt).toISOString(),
  });
}

// ── POST /api/booking/create (free bookings only) ────────────────────────────

async function publicCreateBooking(request, env) {
  if (await isRateLimited('booking', request, env, 5)) {
    return json({ error: 'Too many requests — please try again later.' }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const { hold_id, session_token, client_name, client_email, client_phone } = body;
  if (!client_name || !client_email || !client_phone) {
    return json({ error: 'client_name, client_email, and client_phone are required' }, 400);
  }

  await ensureSchema(env.DB);

  const { valid, hold, error } = await validateHold(hold_id, session_token, env.DB);
  if (!valid) return json({ error }, 400);

  // Fetch service
  const svcId = body.service_id ?? hold.service_id ?? null;
  let service = svcId
    ? await env.DB.prepare('SELECT * FROM admin_services WHERE id = ?').bind(Number(svcId)).first().catch(() => null)
    : null;
  if (!service) service = { id: null, name: 'Session', duration_min: 60, duration: 60, price: 0, meeting_address: '', meeting_type: 'meet' };
  service.duration_min = service.duration_min || service.duration || 60;

  // Verify free
  if ((service.price || 0) > 0) {
    return json({ error: 'This service requires payment.' }, 400);
  }

  const p = buildBookingPayload(body, hold);
  const booking = await insertAndNotify(
    { ...p, price: 0, status: 'confirmed' },
    service, env.DB, env
  );

  await env.DB.prepare('DELETE FROM admin_holds WHERE id = ?').bind(hold_id).run().catch(() => {});

  return json({ confirmation_code: booking.confirmation_code, booking });
}

// ── POST /api/payment/square ─────────────────────────────────────────────────

async function publicPaySquare(request, env) {
  if (await isRateLimited('payment', request, env, 5)) {
    return json({ error: 'Too many requests — please try again later.' }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const { hold_id, session_token, source_id, amount_cents,
          client_name, client_email, client_phone } = body;

  if (!source_id)    return json({ error: 'source_id required (Square card token)' }, 400);
  if (!client_name || !client_email || !client_phone) {
    return json({ error: 'client_name, client_email, and client_phone required' }, 400);
  }

  await ensureSchema(env.DB);

  const { valid, hold, error } = await validateHold(hold_id, session_token, env.DB);
  if (!valid) return json({ error }, 400);

  const svcId  = body.service_id ?? hold.service_id ?? null;
  let service  = svcId
    ? await env.DB.prepare('SELECT * FROM admin_services WHERE id = ?').bind(Number(svcId)).first().catch(() => null)
    : null;
  if (!service) service = { id: null, name: 'Session', duration_min: 60, duration: 60, price: 0, meeting_address: '', meeting_type: 'meet' };
  service.duration_min = service.duration_min || service.duration || 60;

  const cents = amount_cents ?? Math.round((service.price || 0) * 100);
  if (cents <= 0) return json({ error: 'Use /api/booking/create for free bookings' }, 400);

  // Charge the card
  const charge = await squareCharge(source_id, cents, hold_id, env);
  if (!charge.success) return json({ error: charge.error || 'Payment declined' }, 402);

  const p = buildBookingPayload(body, hold);
  const booking = await insertAndNotify(
    { ...p, price: cents / 100, status: 'confirmed', square_payment_id: charge.paymentId },
    service, env.DB, env
  );

  // Store payment ID then release hold
  await env.DB.prepare('UPDATE admin_bookings SET square_payment_id = ? WHERE id = ?')
    .bind(charge.paymentId, booking.id).run().catch(() => {});
  await env.DB.prepare('DELETE FROM admin_holds WHERE id = ?').bind(hold_id).run().catch(() => {});

  return json({ confirmation_code: booking.confirmation_code, booking });
}

// ── POST /api/payment/paypal ─────────────────────────────────────────────────
// Creates the PayPal order and stores hold context so capture can find it.

async function publicPayPalCreateOrder(request, env) {
  if (await isRateLimited('payment', request, env, 5)) {
    return json({ error: 'Too many requests — please try again later.' }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const { hold_id, session_token, amount_cents, client_name, client_email, client_phone } = body;

  if (!client_name || !client_email || !client_phone) {
    return json({ error: 'client_name, client_email, and client_phone required' }, 400);
  }

  await ensureSchema(env.DB);

  const { valid, hold, error } = await validateHold(hold_id, session_token, env.DB);
  if (!valid) return json({ error }, 400);

  const svcId = body.service_id ?? hold.service_id ?? null;
  let service = svcId
    ? await env.DB.prepare('SELECT * FROM admin_services WHERE id = ?').bind(Number(svcId)).first().catch(() => null)
    : null;
  if (!service) service = { id: null, name: 'Session', duration_min: 60, price: 0 };

  const cents = amount_cents ?? Math.round((service.price || 0) * 100);
  if (cents <= 0) return json({ error: 'Use /api/booking/create for free bookings' }, 400);

  try {
    const orderId = await paypalCreateOrder(cents, hold_id, env);

    // Stash full booking context in KV under the PayPal order ID (TTL: 30 min)
    await env.SESSIONS.put(
      `lbm_paypal:${orderId}`,
      JSON.stringify({ ...body, hold_id, session_token }),
      { expirationTtl: 1800 }
    );

    return json({ paypal_order_id: orderId });
  } catch (err) {
    return json({ error: err.message || 'Could not create PayPal order' }, 502);
  }
}

// ── POST /api/payment/paypal/capture ─────────────────────────────────────────

async function publicPayPalCapture(request, env) {
  const { order_id } = await request.json().catch(() => ({}));
  if (!order_id) return json({ error: 'order_id required' }, 400);

  await ensureSchema(env.DB);

  // Capture the PayPal order
  const capture = await paypalCaptureOrder(order_id, env);
  if (!capture.success) return json({ error: capture.error || 'PayPal capture failed' }, 402);

  // Recover booking context from KV
  const raw = await env.SESSIONS.get(`lbm_paypal:${order_id}`, { type: 'json' }).catch(() => null);
  if (!raw) return json({ error: 'Order context not found — may have expired' }, 404);

  const { hold_id, session_token } = raw;
  const { valid, hold, error } = await validateHold(hold_id, session_token, env.DB);
  // Allow slightly-expired hold: PayPal approval can take a few seconds past 5 min
  if (!valid && error !== 'Hold has expired — please select a new time') {
    return json({ error }, 400);
  }

  const svcId = raw.service_id ?? hold?.service_id ?? null;
  let service = svcId
    ? await env.DB.prepare('SELECT * FROM admin_services WHERE id = ?').bind(Number(svcId)).first().catch(() => null)
    : null;
  if (!service) service = { id: null, name: 'Session', duration_min: 60, price: 0, meeting_type: 'meet', meeting_address: '' };
  service.duration_min = service.duration_min || service.duration || 60;

  const cents = raw.amount_cents ?? Math.round((service.price || 0) * 100);
  const p = buildBookingPayload(raw, hold);
  const booking = await insertAndNotify(
    { ...p, price: cents / 100, status: 'confirmed', paypal_order_id: order_id },
    service, env.DB, env
  );

  await env.DB.prepare('UPDATE admin_bookings SET paypal_order_id = ? WHERE id = ?')
    .bind(order_id, booking.id).run().catch(() => {});

  // Clean up KV context and hold
  await env.SESSIONS.delete(`lbm_paypal:${order_id}`).catch(() => {});
  if (hold_id) await env.DB.prepare('DELETE FROM admin_holds WHERE id = ?').bind(hold_id).run().catch(() => {});

  return json({ confirmation_code: booking.confirmation_code, booking });
}

// ── GET /api/booking/confirm?code= ────────────────────────────────────────────

async function publicGetConfirmation(url, env) {
  const code = url.searchParams.get('code');
  if (!code) return json({ error: 'code required' }, 400);

  await ensureSchema(env.DB);

  const row = await env.DB.prepare(
    `SELECT b.*,
            s.name            AS service_name,
            s.duration_min    AS svc_duration_min,
            s.duration        AS svc_duration,
            s.meeting_address AS svc_meeting_address
     FROM admin_bookings b
     LEFT JOIN admin_services s ON b.service_id = s.id
     WHERE b.confirmation_code = ?`
  ).bind(code).first().catch((e) => { console.error('confirm query err:', e); return null; });

  if (!row) return json({ error: 'Booking not found' }, 404);

  // Return public-safe subset (id included so cancel.html can reference the booking)
  return json({
    id:                row.id,
    confirmation_code: row.confirmation_code,
    date:              row.date,
    start_time:        row.start_time || row.time,
    service: {
      name:            row.service_name        || 'Session',
      duration_min:    row.svc_duration_min    || row.svc_duration || 60,
      meeting_address: row.svc_meeting_address || '',
      meeting_type:    row.meeting_type || 'meet',
    },
    client_name:      row.name,
    client_email:     row.email,
    client_phone:     row.client_phone         || '',
    meeting_link:     row.meeting_link         || '',
    meeting_type:     row.meeting_type         || 'meet',
    timezone_client:  row.timezone_client      || 'America/Los_Angeles',
    status:           row.status,
    notes:            row.notes                || '',
  });
}

// ── Phase 4: publicCancelBooking ─────────────────────────────────────────────

async function publicCancelBooking(request, env) {
  const body   = await request.json().catch(() => ({}));
  const code   = body.code;
  const choice = body.choice || 'credit';

  if (!code) return json({ error: 'Confirmation code required' }, 400);

  await ensureSchema(env.DB);

  const booking = await env.DB.prepare(
    'SELECT * FROM admin_bookings WHERE confirmation_code = ?'
  ).bind(code).first().catch(() => null);

  if (!booking) return json({ error: 'Booking not found' }, 404);
  if (booking.status === 'cancelled') return json({ error: 'Booking already cancelled' }, 400);

  let service = null;
  if (booking.service_id) {
    service = await env.DB.prepare('SELECT * FROM admin_services WHERE id = ?')
      .bind(booking.service_id).first().catch(() => null);
  }
  if (!service) {
    service = { name: 'Session', duration_min: 60, duration: 60, meeting_address: '' };
  }
  service.duration_min = service.duration_min || service.duration || 60;

  const startTime  = booking.start_time || booking.time || '09:00';
  const sessionMs  = new Date(booking.date + 'T' + startTime + ':00Z').getTime();
  const hoursUntil = (sessionMs - Date.now()) / 3600000;
  const refundAmount = hoursUntil >= 4 ? Math.round(booking.price * 0.97 * 100) / 100 : 0;

  let creditCode = null;
  if (choice === 'credit' && booking.price > 0) {
    creditCode = 'LBM-CREDIT-' + crypto.randomUUID().slice(0, 6).toUpperCase();
    const ONE_YEAR = 365 * 24 * 60 * 60;
    await env.SESSIONS.put(
      SESSION_PREFIX + 'credit:' + creditCode,
      JSON.stringify({ booking_id: booking.id, original_amount: booking.price, created_at: Date.now() }),
      { expirationTtl: ONE_YEAR }
    );
  }

  await deleteICloudEvent(booking.id, env);
  await env.DB.prepare('UPDATE admin_bookings SET status = ? WHERE id = ?')
    .bind('cancelled', booking.id).run();
  await sendCancellationEmail(booking, service, choice, refundAmount, creditCode, env);

  return json({ ok: true, choice, refundAmount, creditCode });
}

// ── Phase 4: syncSquareServices ───────────────────────────────────────────────

async function syncSquareServices(env) {
  if (!env.SQUARE_ACCESS_TOKEN) {
    return json({ error: 'SQUARE_ACCESS_TOKEN not configured' }, 400);
  }

  const base = env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

  await ensureSchema(env.DB);

  let cursor  = null;
  let objects = [];

  // Paginate through all catalog items
  do {
    const endpoint = cursor
      ? `${base}/v2/catalog/list?types=ITEM&cursor=${encodeURIComponent(cursor)}`
      : `${base}/v2/catalog/list?types=ITEM`;

    const res = await fetch(endpoint, {
      headers: {
        Authorization:    `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-17',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('syncSquareServices fetch error:', err);
      return json({ error: err.errors?.[0]?.detail || `Square ${res.status}` }, 502);
    }

    const data = await res.json();
    objects = objects.concat(data.objects || []);
    cursor  = data.cursor || null;
  } while (cursor);

  let synced = 0;

  // Collect item_types seen for diagnostics
  const seenTypes = [...new Set(objects.filter(o => o.type === 'ITEM').map(o => o.item_data?.item_type || 'unset'))];

  for (const obj of objects) {
    if (obj.type !== 'ITEM') continue;
    const item    = obj.item_data || {};
    const variant = (item.variations || [])[0];
    if (!variant) continue;
    const varData = variant.item_variation_data || {};
    // Accept explicitly-tagged appointment services OR any item with a service_duration
    const isAppointmentService = item.item_type === 'APPOINTMENTS_SERVICE' || varData.service_duration != null;
    if (!isAppointmentService) continue;
    const name       = item.name || '';
    const desc       = item.description || '';
    const priceMoney = varData.price_money;
    const price      = priceMoney ? priceMoney.amount / 100 : 0;
    const durMs      = varData.service_duration;
    const durMin     = durMs ? Math.round(durMs / 60000) : 60;
    const squareId   = obj.id;

    if (!name) continue;

    // Upsert: update if square_item_id matches, insert if new
    const existing = await env.DB.prepare(
      'SELECT id FROM admin_services WHERE square_item_id = ?'
    ).bind(squareId).first().catch(() => null);

    if (existing) {
      await env.DB.prepare(
        'UPDATE admin_services SET name=?, price=?, duration_min=?, duration=?, description=? WHERE square_item_id=?'
      ).bind(name, price, durMin, durMin, desc, squareId).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO admin_services (name, duration, duration_min, price, description, meeting_address, square_item_id, created_at) VALUES (?,?,?,?,?,?,?,?)'
      ).bind(name, durMin, durMin, price, desc, '', squareId, Date.now()).run();
    }
    synced++;
  }

  return json({ ok: true, synced, total: objects.length, seenTypes });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
