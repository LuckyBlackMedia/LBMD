/**
 * LBM Admin — iCloud CalDAV helper
 * Phase 2
 *
 * Uses only CF Workers Web APIs: fetch, btoa, URL, crypto.
 * No Node.js imports. XML parsed with regex.
 *
 * Exports:
 *   discoverCalendarUrl(env)                         → string
 *   getICloudBusySlots(date_from, date_to, env)      → Array<{start,end}>
 *   createICloudEvent(booking, service, env)         → {success, eventUid?}
 *   deleteICloudEvent(bookingId, env)                → {success}
 */

// ── Shared auth header ────────────────────────────────────────────────────────

function _auth(env) {
  return 'Basic ' + btoa(env.ICLOUD_APPLE_ID + ':' + env.ICLOUD_APP_PASSWORD);
}

// ── Inner helper: date+time → iCal UTC string "YYYYMMDDTHHMMSSz" ─────────────

function toICalUTC(dateStr, timeStr) {
  // dateStr: "2026-04-08", timeStr: "14:00"
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m]     = timeStr.split(':').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, m, 0));
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  // → "20260408T140000Z"
}

// ── Inner helper: add minutes to a time, handle day-overflow ────────────────

function addMinutes(dateStr, timeStr, minutes) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m]     = timeStr.split(':').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, m + minutes, 0));
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// ── Inner helper: parse iCal datetime to ISO UTC ─────────────────────────────

function iCalToISO(dtStr) {
  // UTC:  20260408T140000Z  → direct parse
  if (dtStr.endsWith('Z')) {
    const s = dtStr.replace('Z', '');
    return new Date(
      `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}Z`
    ).toISOString();
  }
  // DATE: 20260408  → treat as start of day UTC
  if (dtStr.length === 8) {
    return new Date(`${dtStr.slice(0,4)}-${dtStr.slice(4,6)}-${dtStr.slice(6,8)}T00:00:00Z`).toISOString();
  }
  // Local (no Z, no TZID offset known): treat as UTC with warning
  const s = dtStr;
  return new Date(
    `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}Z`
  ).toISOString();
}

// ── Inner helper: parse TZID-annotated datetime to ISO UTC ──────────────────
// DTSTART;TZID=America/Los_Angeles:20260408T070000
// CF Workers supports Intl so we can use a known epoch trick.

function tzidToISO(dtStr, tzid) {
  // Build a wall-clock ISO string and interpret it in the given timezone.
  const s = dtStr;
  const wall = `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}`;
  try {
    // Use Intl to find the UTC offset at that wall time in the given TZ.
    // Strategy: binary-search-free approach via Date + Intl formatter.
    const naive = new Date(wall + 'Z'); // treat as UTC first
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tzid,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    // Get what that UTC instant looks like in the target TZ
    const parts = formatter.formatToParts(naive);
    const get = (t) => parts.find(p => p.type === t)?.value ?? '00';
    const tzWall = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
    // Compute the offset: tzWall - wall (both as UTC)
    const offsetMs = new Date(tzWall + 'Z') - naive;
    // Apply offset to convert the original wall time to UTC
    const utcMs = new Date(wall + 'Z').getTime() - offsetMs;
    return new Date(utcMs).toISOString();
  } catch (e) {
    console.warn(`caldav: tzid conversion failed for tzid="${tzid}", treating as UTC. Error: ${e}`);
    return new Date(wall + 'Z').toISOString();
  }
}

// ── discoverCalendarUrl ───────────────────────────────────────────────────────

export async function discoverCalendarUrl(env) {
  const auth = _auth(env);
  const headers = {
    Authorization: auth,
    Depth: '1',
    'Content-Type': 'application/xml',
  };

  // Step 1: find current-user-principal
  const principalBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
  </d:prop>
</d:propfind>`;

  let res = await fetch('https://caldav.icloud.com/', {
    method: 'PROPFIND',
    headers,
    body: principalBody,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`caldav discoverCalendarUrl: PROPFIND / returned ${res.status}\n${text}`);
    throw new Error(`CalDAV PROPFIND failed: ${res.status}`);
  }
  let text = await res.text();

  const principalMatch = text.match(/<d:current-user-principal[\s\S]*?<d:href[^>]*>([^<]+)<\/d:href>/i);
  if (!principalMatch) {
    console.error('caldav discoverCalendarUrl: could not parse principal href from:\n' + text);
    throw new Error('Could not find current-user-principal in CalDAV response');
  }
  const principalHref = principalMatch[1].trim();

  // Step 2: find calendar-home-set
  const homeBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set/>
  </d:prop>
</d:propfind>`;

  res = await fetch('https://caldav.icloud.com' + principalHref, {
    method: 'PROPFIND',
    headers,
    body: homeBody,
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`caldav discoverCalendarUrl: PROPFIND principal returned ${res.status}\n${errText}`);
    throw new Error(`CalDAV principal PROPFIND failed: ${res.status}`);
  }
  text = await res.text();

  const homeMatch = text.match(/:calendar-home-set[\s\S]*?<d:href[^>]*>([^<]+)<\/d:href>/i);
  if (!homeMatch) {
    console.error('caldav discoverCalendarUrl: could not parse calendar-home-set from:\n' + text);
    throw new Error('Could not find calendar-home-set in CalDAV response');
  }
  const calendarHomeHref = homeMatch[1].trim();
  const fullUrl = 'https://caldav.icloud.com' + calendarHomeHref;

  console.log(`
╔═══════════════════════════════════════════════════════╗
║  iCloud CalDAV Discovery — Complete                   ║
╠═══════════════════════════════════════════════════════╣
║  Calendar Home URL:                                   ║
║  ${fullUrl.padEnd(53)} ║
╠═══════════════════════════════════════════════════════╣
║  Paste this into wrangler.toml:                       ║
║  ICLOUD_CALENDAR_ID = "${calendarHomeHref.trim()}"   ║
╚═══════════════════════════════════════════════════════╝
`);
  return fullUrl;
}

// ── getICloudBusySlots ────────────────────────────────────────────────────────

export async function getICloudBusySlots(date_from, date_to, env) {
  if (!env.ICLOUD_CALENDAR_ID) {
    console.warn('caldav getICloudBusySlots: ICLOUD_CALENDAR_ID not set — skipping iCloud sync');
    return [];
  }

  const auth     = _auth(env);
  const startUTC = date_from.replace(/-/g, '') + 'T000000Z';
  const endUTC   = date_to.replace(/-/g, '')   + 'T235959Z';

  const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${startUTC}" end="${endUTC}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

  try {
    const res = await fetch(
      `${env.ICLOUD_CALENDAR_URL}/${env.ICLOUD_CALENDAR_ID}`,
      {
        method: 'REPORT',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/xml',
          Depth: '1',
        },
        body: reportBody,
      }
    );

    if (res.status === 401) {
      console.error('caldav getICloudBusySlots: 401 Unauthorized — regenerate app-specific password at appleid.apple.com');
      return [];
    }
    if (!res.ok) {
      console.error(`caldav getICloudBusySlots: REPORT returned ${res.status}`);
      return [];
    }

    const text   = await res.text();
    const blocks = text.match(/<[^:>]*:calendar-data[^>]*>([\s\S]*?)<\/[^:>]*:calendar-data>/gi) || [];
    const busy   = [];

    for (const block of blocks) {
      const vevMatch = block.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/);
      if (!vevMatch) continue;
      const vevent = vevMatch[1];

      // Skip cancelled or transparent events
      if (/STATUS:CANCELLED/i.test(vevent))    continue;
      if (/TRANSP:TRANSPARENT/i.test(vevent))  continue;

      // Extract DTSTART
      const dtStartRaw = vevent.match(/DTSTART(?:;[^:]*)?:([^\r\n]+)/i);
      const dtEndRaw   = vevent.match(/DTEND(?:;[^:]*)?:([^\r\n]+)/i);
      if (!dtStartRaw) continue;

      const dtStartLine = vevent.match(/DTSTART(;[^:]*)?:([^\r\n]+)/i);
      const dtEndLine   = vevent.match(/DTEND(;[^:]*)?:([^\r\n]+)/i);
      const startAttrs  = dtStartLine?.[1] || '';
      const startVal    = dtStartLine?.[2]?.trim() || '';
      const endAttrs    = dtEndLine?.[1] || '';
      const endVal      = dtEndLine?.[2]?.trim() || '';

      let startISO, endISO;

      // All-day (VALUE=DATE)
      if (/VALUE=DATE/i.test(startAttrs) || startVal.length === 8) {
        startISO = iCalToISO(startVal) ;
        endISO   = endVal ? new Date(iCalToISO(endVal.length === 8 ? endVal : endVal)).toISOString()
                          : new Date(new Date(startISO).setUTCHours(23, 59, 59)).toISOString();
      }
      // TZID-annotated
      else if (/TZID=/i.test(startAttrs)) {
        const tzid = startAttrs.match(/TZID=([^;]+)/i)?.[1] || 'UTC';
        startISO = tzidToISO(startVal, tzid);
        endISO   = endVal
          ? (/TZID=/i.test(endAttrs)
              ? tzidToISO(endVal, endAttrs.match(/TZID=([^;]+)/i)?.[1] || tzid)
              : iCalToISO(endVal))
          : startISO;
      }
      // UTC (ends with Z)
      else {
        startISO = iCalToISO(startVal);
        endISO   = endVal ? iCalToISO(endVal) : startISO;
      }

      busy.push({ start: startISO, end: endISO });
    }

    return busy;
  } catch (err) {
    console.error('caldav getICloudBusySlots error:', err);
    return [];
  }
}

// ── createICloudEvent ─────────────────────────────────────────────────────────

export async function createICloudEvent(booking, service, env) {
  if (!env.ICLOUD_CALENDAR_ID) {
    return { success: false, error: 'ICLOUD_CALENDAR_ID not set' };
  }

  const auth    = _auth(env);
  const dtStart = toICalUTC(booking.date, booking.start_time || booking.time);
  const dtEnd   = addMinutes(booking.date, booking.start_time || booking.time, service.duration_min || service.duration || 60);
  const now     = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  // Build meeting description
  let descLines = '';
  const mt = (booking.meeting_type || 'meet').toLowerCase();
  if (mt === 'meet' || mt === 'zoom') {
    descLines += `Video Call\\nLink: ${booking.meeting_link || 'TBD'}\\n\\n`;
  } else if (mt === 'facetime') {
    descLines += `FaceTime\\nCall: ${booking.client_phone || booking.phone || ''}\\n\\n`;
  } else if (mt === 'phone') {
    descLines += `Phone Call\\nNumber: ${booking.client_phone || booking.phone || ''}\\n\\n`;
  } else if (mt === 'inperson') {
    descLines += `In Person\\nAddress: ${service.meeting_address || ''}\\n\\n`;
  }
  descLines += `Notes: ${booking.notes || 'None'}\\n`;
  descLines += `Ref: ${booking.confirmation_code || booking.id}`;

  const eventUid = `${booking.id}@myluckyblackmedia.com`;
  const adminEmail = env.ADMIN_EMAIL || 'bookings@myluckyblackmedia.com';
  const clientName  = booking.client_name  || booking.name  || 'Client';
  const clientEmail = booking.client_email || booking.email || '';

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lucky Black Media//Booking System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${eventUid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${service.name} \u2013 ${clientName}`,
    `DESCRIPTION:${descLines}`,
    `ORGANIZER;CN=Lucky Black Media:mailto:${adminEmail}`,
    `ATTENDEE;CN=${clientName};RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${clientEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const url = `${env.ICLOUD_CALENDAR_URL}/${env.ICLOUD_CALENDAR_ID}/${booking.id}.ics`;

  const doPut = async (extraHeaders = {}) => {
    return fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'text/calendar;charset=utf-8',
        'If-None-Match': '*',
        ...extraHeaders,
      },
      body: ical,
    });
  };

  try {
    let res = await doPut({ 'If-None-Match': '*' });

    // 412 Precondition Failed = event already exists → retry without If-None-Match
    if (res.status === 412) {
      res = await doPut({});
    }

    if (res.status === 201 || res.status === 200 || res.status === 204) {
      return { success: true, eventUid };
    }

    const errText = await res.text();
    console.error(`caldav createICloudEvent: PUT returned ${res.status}\n${errText}`);
    return { success: false, error: `PUT ${res.status}` };
  } catch (err) {
    console.error('caldav createICloudEvent error:', err);
    return { success: false, error: String(err) };
  }
}

// ── deleteICloudEvent ─────────────────────────────────────────────────────────

export async function deleteICloudEvent(bookingId, env) {
  if (!env.ICLOUD_CALENDAR_ID) {
    return { success: false, error: 'ICLOUD_CALENDAR_ID not set' };
  }

  const auth = _auth(env);
  const url  = `${env.ICLOUD_CALENDAR_URL}/${env.ICLOUD_CALENDAR_ID}/${bookingId}.ics`;

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: auth },
    });

    if (res.status === 204) return { success: true };
    if (res.status === 404) return { success: true }; // already gone — idempotent

    const errText = await res.text();
    console.error(`caldav deleteICloudEvent: DELETE returned ${res.status}\n${errText}`);
    return { success: false, error: `DELETE ${res.status}` };
  } catch (err) {
    console.error('caldav deleteICloudEvent error:', err);
    return { success: false, error: String(err) };
  }
}
