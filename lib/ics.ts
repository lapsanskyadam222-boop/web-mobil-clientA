// lib/ics.ts
function toICSDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = date.getUTCFullYear();
  const MM = pad(date.getUTCMonth() + 1);
  const DD = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${YYYY}${MM}${DD}T${hh}${mm}${ss}Z`;
}

export function buildICS(opts: {
  title: string;
  start: Date;             // začiatok (lokálny → konvertuje sa do UTC)
  durationMinutes: number; // trvanie
  location?: string;
  description?: string;
}) {
  const dtStart = toICSDate(opts.start);
  const end = new Date(opts.start.getTime() + opts.durationMinutes * 60_000);
  const dtEnd = toICSDate(end);
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@rezervacia`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rezervacny system//NONSGML v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${opts.title}`,
    opts.location ? `LOCATION:${opts.location}` : '',
    opts.description ? `DESCRIPTION:${opts.description.replace(/\n/g, '\\n')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}
