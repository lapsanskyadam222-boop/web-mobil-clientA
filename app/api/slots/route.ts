export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = {
  id: string;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:mm
  locked?: boolean;
  booked?: boolean;
  capacity?: number;      // default 1
  bookedCount?: number;   // default 0
};
type SlotsPayload = { slots: Slot[]; updatedAt: string };

const KEY = 'slots.json';
const EMPTY: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };

const noCache = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

// ───────────────────────────────────────────────────────────────────────────────
// helpers
function makeId(date: string, time: string) {
  return `${date}_${time}`.replaceAll(':', '');
}
function isIsoDate(s?: string) {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isHm(s?: string) {
  return !!s && /^\d{2}:\d{2}$/.test(s);
}
function findIndex(slots: Slot[], q: { date: string; time: string }) {
  return slots.findIndex(s => s.date === q.date && s.time === q.time);
}
async function readFresh(): Promise<SlotsPayload> {
  const data = await readJson<SlotsPayload>(KEY, EMPTY);
  if (!Array.isArray(data.slots)) return { ...EMPTY, slots: [] };
  // malá normalizácia (doplníme capacity/bookedCount)
  for (const s of data.slots) {
    if (!Number.isFinite(+s.capacity!)) s.capacity = 1;
    if (!Number.isFinite(+s.bookedCount!)) s.bookedCount = s.booked ? 1 : 0;
  }
  return data;
}
// ───────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const data = await readFresh();
    if (!data.updatedAt) data.updatedAt = new Date().toISOString();
    return NextResponse.json(data, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'GET /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/** POST – pridanie slotov
 * request body:
 *  - { slots: [{ date:'YYYY-MM-DD', time:'HH:mm', capacity?: number }, ...] }
 *  - alebo { date, times:[ '13:00', '14:00', ... ], capacity?: number }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as
      | { slots?: { date: string; time: string; capacity?: number }[] }
      | { date?: string; times?: string[]; capacity?: number };

    const toAdd: { date: string; time: string; capacity?: number }[] = [];
    if ('slots' in body && Array.isArray(body.slots)) {
      for (const s of body.slots) if (isIsoDate(s.date) && isHm(s.time)) toAdd.push(s);
    } else if ('date' in body && isIsoDate(body.date) && Array.isArray(body.times)) {
      for (const t of body.times) if (isHm(t)) toAdd.push({ date: body.date, time: t, capacity: body.capacity });
    }
    if (!toAdd.length) {
      return NextResponse.json({ error: 'Chýbajú platné sloty.' }, { status: 400, headers: noCache });
    }

    const data = await readFresh();
    for (const s of toAdd) {
      const cap = Number.isFinite(+s.capacity!) ? Math.max(1, +s.capacity!) : 1;
      const id = makeId(s.date, s.time);
      const idx = findIndex(data.slots, { date: s.date, time: s.time });
      const base: Slot = {
        id, date: s.date, time: s.time,
        locked: false, booked: false,
        capacity: cap, bookedCount: 0,
      };
      if (idx >= 0) data.slots[idx] = { ...base }; else data.slots.push(base);
    }
    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);

    return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/** PATCH – úpravy existujúcich slotov
 * body môže byť:
 *  A) { id,            action:'delete'|'lock'|'unlock'|'capacity', capacity? }
 *  B) { date,time,     action:'delete'|'lock'|'unlock'|'capacity', capacity? }
 *  C) { date,          action:'lockDay'|'unlockDay' }
 */
type PatchA = { id: string; action: 'delete'|'lock'|'unlock'|'capacity'; capacity?: number };
type PatchB = { date: string; time: string; action: 'delete'|'lock'|'unlock'|'capacity'; capacity?: number };
type PatchC = { date: string; action: 'lockDay'|'unlockDay' };
type PatchBody = PatchA | PatchB | PatchC;

function isA(p: PatchBody): p is PatchA { return 'id' in p; }
function isB(p: PatchBody): p is PatchB { return 'time' in p && 'date' in p; }
function isC(p: PatchBody): p is PatchC { return !('time' in p) && 'date' in p; }

export async function PATCH(req: Request) {
  try {
    const p = await req.json() as PatchBody;

    const data = await readFresh();

    // C) zamknúť/odomknúť celý deň
    if (isC(p)) {
      if (!isIsoDate(p.date) || (p.action !== 'lockDay' && p.action !== 'unlockDay')) {
        return NextResponse.json({ error: 'Neplatná požiadavka.' }, { status: 400, headers: noCache });
      }
      const lock = p.action === 'lockDay';
      for (const s of data.slots) if (s.date === p.date) s.locked = lock;
      data.updatedAt = new Date().toISOString();
      await writeJson(KEY, data);
      return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
    }

    // A/B) operácia nad konkrétnym slotom
    let idx = -1;
    if (isA(p)) {
      idx = data.slots.findIndex(s => s.id === p.id);
    } else if (isB(p)) {
      if (!isIsoDate(p.date) || !isHm(p.time)) {
        return NextResponse.json({ error: 'Neplatný date/time.' }, { status: 400, headers: noCache });
      }
      idx = findIndex(data.slots, { date: p.date, time: p.time });
    } else {
      return NextResponse.json({ error: 'Neznámy payload.' }, { status: 400, headers: noCache });
    }

    if (idx < 0) {
      return NextResponse.json({ error: 'Slot neexistuje.' }, { status: 404, headers: noCache });
    }

    const action = (p as any).action as PatchA['action']|PatchB['action'];
    if (action === 'delete') {
      data.slots.splice(idx, 1);
    } else if (action === 'lock' || action === 'unlock') {
      data.slots[idx].locked = action === 'lock';
    } else if (action === 'capacity') {
      const safe = Number.isFinite(+(p as PatchA|PatchB).capacity!)
        ? Math.max(1, +((p as PatchA|PatchB).capacity!)) : 1;
      data.slots[idx].capacity = safe;
      // nechávame bookedCount ako je (je stav rezervácií)
    } else {
      return NextResponse.json({ error: 'Neznáma akcia.' }, { status: 400, headers: noCache });
    }

    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);

    return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'PATCH /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/** DELETE – úplné vymazanie všetkých slotov (reset) */
export async function DELETE() {
  try {
    const empty: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };
    await writeJson(KEY, empty);
    return NextResponse.json({ ok: true, slots: [] }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'DELETE /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}
