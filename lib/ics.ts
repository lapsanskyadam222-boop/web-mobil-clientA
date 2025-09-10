// /lib/ics.ts
function pad(n: number) {
  return String(n).padStart(2, '0');
}

function escapeText(s: string) {
  return (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Vytvorí reťazec YYYYMMDDTHHmmss (bez Z a bez TZID) – "floating time"
function fmtFloating(y: number, m: number, d: number, hh: number, mm: number, ss = 0) {
  return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}${pad(ss)}`;
}

export function buildICS(opts: {
  title: string;
  description?: string;
  location?: string;
  startLocalParts: { year: number; month: number; day: number; hour: number; minute: number };
  durationMinutes: number;
}) {
  const { title, description = '', location = '', startLocalParts, durationMinutes } = opts;

  const { year, month, day, hour, minute } = startLocalParts;

  // koniec = začiatok + duration
  const startDate = new Date(year, month - 1, day, hour, minute, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);

  const dtStart = fmtFloating(year, month, day, hour, minute, 0);
  const dtEnd = fmtFloating(
    endDate.getFullYear(),
    endDate.getMonth() + 1,
    endDate.getDate(),
    endDate.getHours(),
    endDate.getMinutes(),
    0
  );

  // DTSTAMP v UTC podľa špecifikácie
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const uid = `${dtstamp}-${Math.random().toString(36).slice(2)}@rezervacny-system`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rezervacny System//Booking//SK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    // floating local time
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}
