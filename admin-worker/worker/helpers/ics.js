/**
 * LBM Admin — ICS file generator
 * Phase 2
 *
 * RFC 5545 compliant. Works with Apple Calendar, Google Calendar, Outlook.
 * No imports — pure string manipulation.
 *
 * Exports:
 *   generateICS(booking, service, adminEmail) → string (VCALENDAR text)
 */

// ── RFC 5545 line folding — max 75 octets, continuation lines start with space

function foldLine(line) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const chars  = [...line];
  const out    = [];
  let   current = '';
  for (const ch of chars) {
    const test = current + ch;
    if (encoder.encode(test).length > 75) {
      out.push(current);
      current = ' ' + ch;
    } else {
      current = test;
    }
  }
  if (current) out.push(current);
  return out.join('\r\n');
}

// ── RFC 5545 value escaping ───────────────────────────────────────────────────

function escapeICS(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g,  '\\,')
    .replace(/;/g,  '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

// ── date+time → iCal UTC string "YYYYMMDDTHHMMSSz" ──────────────────────────

function toICalUTC(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m]     = timeStr.split(':').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, m, 0));
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// ── Add minutes to date+time, handle day overflow ────────────────────────────

function addMinutes(dateStr, timeStr, minutes) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m]     = timeStr.split(':').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, m + minutes, 0));
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// ── generateICS ───────────────────────────────────────────────────────────────

export function generateICS(booking, service, adminEmail) {
  const startTime   = booking.start_time || booking.time || '09:00';
  const durationMin = service.duration_min || service.duration || 60;
  const tz          = booking.timezone_client || 'America/Los_Angeles';
  const clientName  = booking.client_name  || booking.name  || 'Client';
  const clientEmail = booking.client_email || booking.email || '';
  const confirmCode = booking.confirmation_code || String(booking.id);
  const from        = adminEmail || 'bookings@myluckyblackmedia.com';

  const dtStart = toICalUTC(booking.date, startTime);
  const dtEnd   = addMinutes(booking.date, startTime, durationMin);
  const now     = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid     = `${booking.id}@myluckyblackmedia.com`;

  // Human-readable date and time in client timezone
  const startDate = new Date(
    Date.UTC(
      ...booking.date.split('-').map((v, i) => i === 1 ? Number(v) - 1 : Number(v)),
      ...startTime.split(':').map(Number),
    )
  );
  const humanDate = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(startDate);
  const humanTime = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(startDate);

  // Meeting-type specific line
  const mt = (booking.meeting_type || 'meet').toLowerCase();
  let meetLine = '';
  let locationVal = '';
  if (mt === 'meet' || mt === 'zoom') {
    meetLine  = `Join here: ${booking.meeting_link || 'Link will be sent'}`;
  } else if (mt === 'facetime') {
    meetLine  = `FaceTime: ${booking.client_phone || booking.phone || ''}`;
  } else if (mt === 'phone') {
    meetLine  = `We will call: ${booking.client_phone || booking.phone || ''}`;
  } else if (mt === 'inperson') {
    meetLine  = `Location: ${service.meeting_address || ''}`;
    locationVal = service.meeting_address || '';
  }

  // DESCRIPTION (escaped)
  const descRaw = [
    'Your booking is confirmed!',
    '',
    `Service: ${service.name}`,
    `Date: ${humanDate}`,
    `Time: ${humanTime} (${tz})`,
    `Duration: ${durationMin} minutes`,
    '',
    meetLine,
    '',
    `Confirmation: ${confirmCode}`,
    `Questions? ${from}`,
    '',
    'Cancel policy: Full refund minus processing fees if cancelled 4+ hours before. Full rebook credit available.',
    'Cancel at: https://admin.myluckyblackmedia.com/cancel',
  ].filter(l => l !== null).join('\n');

  const description = escapeICS(descRaw);

  // Confirmation URL
  const confirmUrl = `https://admin.myluckyblackmedia.com/book?confirm=${encodeURIComponent(confirmCode)}`;

  // Build lines array then fold each
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lucky Black Media//Booking System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:Your booking - ${escapeICS(service.name)} with Lucky Black Media`,
    `DESCRIPTION:${description}`,
    locationVal ? `LOCATION:${escapeICS(locationVal)}` : 'LOCATION:',
    `URL:${confirmUrl}`,
    `ORGANIZER;CN=Lucky Black Media:mailto:${from}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${escapeICS(clientName)}:mailto:${clientEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Tomorrow: ${escapeICS(service.name)} with Lucky Black Media`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:1 hour: ${escapeICS(service.name)} with Lucky Black Media`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldLine).join('\r\n') + '\r\n';
}
