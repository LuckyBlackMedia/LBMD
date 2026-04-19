/**
 * LBM Admin — Transactional email via Resend
 * Phase 2
 *
 * Secrets required:
 *   RESEND_API_KEY — from resend.com dashboard
 *   ADMIN_EMAIL    — owner email (BCC/CC on all sends)
 *
 * Exports:
 *   sendConfirmationEmail(booking, service, env)
 *   sendReminderEmail(booking, service, env)
 *   sendCancellationEmail(booking, service, choice, refundAmount, creditCode, env)
 *
 * All functions: console.error on failure, return {ok:false} — never throw.
 */

import { generateICS } from './ics.js';

const RESEND_URL = 'https://api.resend.com/emails';
const FROM       = 'Lucky Black Media <project_inquiries@myluckyblackmedia.com>';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD     = '#B8962E';
const CHARCOAL = '#1a1a1a';
const NAVY     = '#0a1628';
const SURFACE  = '#111827';
const TEXT     = '#f9fafb';
const MUTED    = '#9ca3af';

// ── Shared email shell ────────────────────────────────────────────────────────

function shell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${NAVY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY};padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${SURFACE};border-radius:12px;overflow:hidden;border:1px solid rgba(184,150,46,0.2);">
      <!-- Header -->
      <tr>
        <td style="background:${CHARCOAL};padding:24px 32px;border-bottom:2px solid ${GOLD};">
          <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${GOLD};font-weight:600;">Lucky Black Media</p>
          <h1 style="margin:6px 0 0;font-size:22px;color:${TEXT};font-weight:700;">${title}</h1>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:32px;">
          ${bodyHtml}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="padding:20px 32px;background:${CHARCOAL};border-top:1px solid rgba(184,150,46,0.15);">
          <p style="margin:0;font-size:12px;color:${MUTED};text-align:center;">
            Lucky Black Media &nbsp;·&nbsp; myluckyblackmedia.com<br>
            Questions? Reply to this email or visit
            <a href="https://www.myluckyblackmedia.com" style="color:${GOLD};text-decoration:none;">myluckyblackmedia.com</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Inner: send via Resend ────────────────────────────────────────────────────

async function _send(env, payload) {
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.status);
    throw new Error(`Resend ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Inner: human-readable time in client TZ ───────────────────────────────────

function humanTime(booking) {
  const tz        = booking.timezone_client || 'America/Los_Angeles';
  const startTime = booking.start_time || booking.time || '09:00';
  const [y, mo, d] = booking.date.split('-').map(Number);
  const [h, m]     = startTime.split(':').map(Number);
  const dt         = new Date(Date.UTC(y, mo - 1, d, h, m));
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(dt);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(dt);
  return { date, time, tz };
}

// ── Inner: meeting detail row ────────────────────────────────────────────────

function meetingRow(booking, service) {
  const mt = (booking.meeting_type || 'meet').toLowerCase();
  if (mt === 'meet' || mt === 'zoom') {
    return `<tr>
      <td style="padding:4px 0;color:${MUTED};font-size:13px;width:120px;">Join link</td>
      <td style="padding:4px 0;color:${TEXT};font-size:13px;">
        <a href="${booking.meeting_link || '#'}" style="color:${GOLD};">${booking.meeting_link || 'Link will be sent'}</a>
      </td>
    </tr>`;
  }
  if (mt === 'facetime') {
    return `<tr>
      <td style="padding:4px 0;color:${MUTED};font-size:13px;">FaceTime</td>
      <td style="padding:4px 0;color:${TEXT};font-size:13px;">${booking.client_phone || booking.phone || ''}</td>
    </tr>`;
  }
  if (mt === 'phone') {
    return `<tr>
      <td style="padding:4px 0;color:${MUTED};font-size:13px;">Phone call</td>
      <td style="padding:4px 0;color:${TEXT};font-size:13px;">We'll call ${booking.client_phone || booking.phone || ''}</td>
    </tr>`;
  }
  if (mt === 'inperson') {
    return `<tr>
      <td style="padding:4px 0;color:${MUTED};font-size:13px;">Location</td>
      <td style="padding:4px 0;color:${TEXT};font-size:13px;">${service.meeting_address || ''}</td>
    </tr>`;
  }
  return '';
}

// ── sendConfirmationEmail ─────────────────────────────────────────────────────

export async function sendConfirmationEmail(booking, service, env) {
  try {
    const adminEmail  = env.ADMIN_EMAIL || '';
    const clientName  = booking.client_name  || booking.name  || 'there';
    const clientEmail = booking.client_email || booking.email || '';
    const confirmCode = booking.confirmation_code || String(booking.id);
    const { date, time, tz } = humanTime(booking);
    const durationMin = service.duration_min || service.duration || 60;

    const bodyHtml = `
<p style="color:${TEXT};font-size:16px;margin:0 0 24px;">Hi ${clientName},</p>
<p style="color:${MUTED};font-size:14px;margin:0 0 24px;">Your booking has been confirmed. Here are the details:</p>

<!-- Details table -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
  <tr>
    <td style="padding:4px 0;color:${MUTED};font-size:13px;width:120px;">Service</td>
    <td style="padding:4px 0;color:${TEXT};font-size:13px;font-weight:600;">${service.name}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;color:${MUTED};font-size:13px;">Date</td>
    <td style="padding:4px 0;color:${TEXT};font-size:13px;">${date}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;color:${MUTED};font-size:13px;">Time</td>
    <td style="padding:4px 0;color:${TEXT};font-size:13px;">${time} <span style="color:${MUTED};">(${tz})</span></td>
  </tr>
  <tr>
    <td style="padding:4px 0;color:${MUTED};font-size:13px;">Duration</td>
    <td style="padding:4px 0;color:${TEXT};font-size:13px;">${durationMin} minutes</td>
  </tr>
  ${meetingRow(booking, service)}
</table>

<!-- Confirmation code -->
<div style="background:rgba(184,150,46,0.1);border:1px solid rgba(184,150,46,0.3);border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
  <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};">Confirmation Code</p>
  <p style="margin:0;font-size:20px;font-weight:700;color:${TEXT};letter-spacing:2px;">${confirmCode}</p>
</div>

<p style="color:${MUTED};font-size:13px;margin:0 0 8px;">
  The .ics file attached to this email lets you add this booking to your calendar.
</p>
<p style="color:${MUTED};font-size:13px;margin:0 0 24px;">
  <strong style="color:${TEXT};">Cancel policy:</strong> Full refund minus processing fees if cancelled 4+ hours before your session.
  Full rebook credit is always available.<br>
  <a href="https://admin.myluckyblackmedia.com/cancel" style="color:${GOLD};">Cancel or reschedule →</a>
</p>`;

    const icsContent = generateICS(booking, service, adminEmail);
    const icsBase64  = btoa(Array.from(new TextEncoder().encode(icsContent), b => String.fromCharCode(b)).join(''));

    await _send(env, {
      from:        FROM,
      to:          [clientEmail],
      bcc:         adminEmail ? [adminEmail] : undefined,
      subject:     `Your booking is confirmed \u2013 ${service.name}`,
      html:        shell(`Your booking is confirmed`, bodyHtml),
      attachments: [{
        filename:    'booking.ics',
        content:     icsBase64,
        content_type: 'text/calendar',
      }],
    });

    return { ok: true };
  } catch (err) {
    console.error('email sendConfirmationEmail error:', err);
    return { ok: false, error: String(err) };
  }
}

// ── sendReminderEmail ─────────────────────────────────────────────────────────

export async function sendReminderEmail(booking, service, env) {
  try {
    const clientName  = booking.client_name  || booking.name  || 'there';
    const clientEmail = booking.client_email || booking.email || '';
    const { date, time, tz } = humanTime(booking);

    const bodyHtml = `
<p style="color:${TEXT};font-size:16px;margin:0 0 24px;">Hi ${clientName},</p>
<p style="color:${MUTED};font-size:14px;margin:0 0 24px;">
  Just a friendly reminder — your session is <strong style="color:${TEXT};">tomorrow</strong>.
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
  <tr>
    <td style="padding:4px 0;color:${MUTED};font-size:13px;width:120px;">Service</td>
    <td style="padding:4px 0;color:${TEXT};font-size:13px;font-weight:600;">${service.name}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;color:${MUTED};font-size:13px;">Date</td>
    <td style="padding:4px 0;color:${TEXT};font-size:13px;">${date}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;color:${MUTED};font-size:13px;">Time</td>
    <td style="padding:4px 0;color:${TEXT};font-size:13px;">${time} <span style="color:${MUTED};">(${tz})</span></td>
  </tr>
  ${meetingRow(booking, service)}
</table>

<p style="color:${MUTED};font-size:13px;margin:0 0 16px;">
  Need to cancel or reschedule?
  <a href="https://admin.myluckyblackmedia.com/cancel" style="color:${GOLD};">Do it here →</a>
</p>`;

    await _send(env, {
      from:    FROM,
      to:      [clientEmail],
      subject: `Reminder: ${service.name} is tomorrow`,
      html:    shell(`Reminder: ${service.name} is tomorrow`, bodyHtml),
    });

    return { ok: true };
  } catch (err) {
    console.error('email sendReminderEmail error:', err);
    return { ok: false, error: String(err) };
  }
}

// ── sendCancellationEmail ─────────────────────────────────────────────────────

export async function sendCancellationEmail(booking, service, choice, refundAmount, creditCode, env) {
  try {
    const adminEmail  = env.ADMIN_EMAIL || '';
    const clientName  = booking.client_name  || booking.name  || 'there';
    const clientEmail = booking.client_email || booking.email || '';
    const { date, time, tz } = humanTime(booking);

    let refundBlock = '';
    if (choice === 'refund' && refundAmount > 0) {
      refundBlock = `
<div style="background:rgba(184,150,46,0.08);border:1px solid rgba(184,150,46,0.25);border-radius:8px;padding:16px;margin-bottom:24px;">
  <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};">Refund Issued</p>
  <p style="margin:0;font-size:20px;font-weight:700;color:${TEXT};">$${refundAmount.toFixed(2)}</p>
  <p style="margin:8px 0 0;font-size:12px;color:${MUTED};">Minus Stripe processing fees. Allow 5–10 business days to appear on your statement.</p>
</div>`;
    } else if (choice === 'refund' && refundAmount === 0) {
      refundBlock = `
<div style="background:rgba(184,150,46,0.08);border:1px solid rgba(184,150,46,0.25);border-radius:8px;padding:16px;margin-bottom:24px;">
  <p style="margin:0;font-size:14px;color:${MUTED};">This booking was cancelled within 4 hours of the session — no refund applies per our cancellation policy.</p>
</div>`;
    } else if (choice === 'credit' && creditCode) {
      refundBlock = `
<div style="background:rgba(184,150,46,0.1);border:1px solid rgba(184,150,46,0.3);border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
  <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};">Rebook Credit Code</p>
  <p style="margin:0;font-size:22px;font-weight:700;color:${TEXT};letter-spacing:2px;">${creditCode}</p>
  <p style="margin:8px 0 0;font-size:12px;color:${MUTED};">Use this code when booking your next session. Valid for 12 months.</p>
</div>`;
    }

    const bodyHtml = `
<p style="color:${TEXT};font-size:16px;margin:0 0 24px;">Hi ${clientName},</p>
<p style="color:${MUTED};font-size:14px;margin:0 0 24px;">Your booking has been cancelled. Here's a summary:</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
  <tr>
    <td style="padding:4px 0;color:${MUTED};font-size:13px;width:120px;">Service</td>
    <td style="padding:4px 0;color:${TEXT};font-size:13px;">${service.name}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;color:${MUTED};font-size:13px;">Was scheduled</td>
    <td style="padding:4px 0;color:${TEXT};font-size:13px;">${date} at ${time} (${tz})</td>
  </tr>
</table>

${refundBlock}

<p style="color:${MUTED};font-size:13px;margin:0 0 8px;">
  Want to rebook?
  <a href="https://admin.myluckyblackmedia.com/book" style="color:${GOLD};">Book a new session →</a>
</p>`;

    await _send(env, {
      from:    FROM,
      to:      [clientEmail],
      cc:      adminEmail ? [adminEmail] : undefined,
      subject: `Your booking has been cancelled \u2013 ${service.name}`,
      html:    shell(`Your booking has been cancelled`, bodyHtml),
    });

    return { ok: true };
  } catch (err) {
    console.error('email sendCancellationEmail error:', err);
    return { ok: false, error: String(err) };
  }
}
