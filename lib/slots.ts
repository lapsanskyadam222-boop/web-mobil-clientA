import type { WorkWindow } from '@/lib/types';

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function toHHMM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Vráti zoznam štartov (HH:MM), kam sa zmestí celá služba (durationMin),
 * s uplatnením bufferMin medzi rezerváciami (iba medzi rezerváciami).
 */
export function computeStartsForService(params: {
  windows: WorkWindow[];
  intervalMin: number;
  bufferMin: number;
  durationMin: number;
  reservations: { start: string; end: string }[];
}): string[] {
  const { windows, intervalMin, bufferMin, durationMin, reservations } = params;

  const existing = reservations
    .map(r => ({ s: toMin(r.start), e: toMin(r.end) }))
    .sort((a, b) => a.s - b.s);

  const out: string[] = [];

  for (const w of windows) {
    const ws = toMin(w.start);
    const we = toMin(w.end);

    for (let start = ws; start + durationMin <= we; start += intervalMin) {
      const end = start + durationMin;

      // presah okna
      if (end > we) continue;

      // nájdi susedov
      const prev = [...existing].reverse().find(r => r.s < start);
      const next = existing.find(r => r.s >= start);

      // buffer voči predchádzajúcej a nasledujúcej
      if (prev && !(prev.e + bufferMin <= start)) continue;
      if (next && !(end + bufferMin <= next.s)) continue;

      // nepretína žiadnu existujúcu rezerváciu
      const conflict = existing.some(r => overlaps(start, end, r.s, r.e));
      if (conflict) continue;

      out.push(toHHMM(start));
    }
  }

  // unikátne a zoradené
  return Array.from(new Set(out)).sort();
}
