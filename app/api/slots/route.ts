export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = {
  id: string;            // unikátne ID
  date: string;          // 'YYYY-MM-DD'
  time: string;          // 'HH:mm'
  locked?: boolean;      // zamknutý termín
  booked?: boolean;      // flag jedného človeka (legacy – ponecháme)
  capacity?: number;     // max osôb pre slot (>=1)
  bookedCount?: number;  // už rezervovaných osôb
};
type SlotsPayload = { slots: Slot[]; updatedAt: string };

const KEY = 'slots.json';
const EMPTY: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };

const noCache = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

/* Helpers */
function makeId(date: string, time: string) {
  // bez replaceAll – kompatibilné s lib < ES2021
  return `${date}_${time.split(':').join('')}`;
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
  // normalizácia kapacity & bookedCount (ochrana voči starým dátam)
  for (const s of data.slots) {
    if (!Number.isFinite(s.capacity!)) s.capacity = 1;
    if (!Number.isFinite(s.bookedCount!)) s.bookedCount = s.booked ? 1 : 0;
  }
  return data;
}

/* GET – vráť aktuálne sloty (vždy fresh) */
export async function GET() {
  try {
    const data = await readFresh();
    return NextResponse.json(data, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'GET /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/* POST – pridanie slotov
   Akceptuje:
   1) { date, time, capacity? }
   2) { date, times: string[], capacity? }
   3) { slots: { date, time, capacity? }[] }
*/
export async function POST(req: Request) {
  try {
    const body = await req.json() as
      | { date?: string; time?: string; capacity?: number }
      | { date?: string; times?: string[]; capacity?: number }
      | { slots?: { date: string; time: string; capacity?: number }[] };

    const toAdd: { date: string; time: string; capacity: number }[] = [];

    if ('slots' in body && Array.isArray(body.slots)) {
      for (const s of body.slots) {
        if (isIsoDate(s?.date) && isHm(s?.time)) {
          const cap = Number.isFinite(+s.capacity!) ? Math.max(1, +s.capacity!) : 1;
          toAdd.push({ date: s.date, time: s.time, capacity: cap });
        }
      }
    } else if ('times' in body && isIsoDate(body.date) && Array.isArray(body.times)) {
      for (const t of body.times) {
        if (isHm(t)) {
          const cap = Number.isFinite(+body.capacity!) ? Math.max(1, +body.capacity!) : 1;
          toAdd.push({ date: body.date!, time: t, capacity: cap });
        }
      }
    } else if ('date' in body && 'time' in body && isIsoDate(body.date) && isHm(body.time)) {
      const cap = Number.isFinite(+body.capacity!) ? Math.max(1, +body.capacity!) : 1;
      toAdd.push({ date: body.date, time: body.time, capacity: cap });
    }

    if (!toAdd.length) {
      return NextResponse.json({ error: 'Chýbajú platné sloty.' }, { status: 400, headers: noCache });
    }

    const data = await readFresh();
    for (const s of toAdd) {
      const id = makeId(s.date, s.time);
      const idx = findIndex(data.slots, { date: s.date, time: s.time });
      const base: Slot = {
        id, date: s.date, time: s.time,
        locked: false, booked: false,
        capacity: s.capacity, bookedCount: 0,
      };
      if (idx >= 0) data.slots[idx] = { ...base, ...data.slots[idx], capacity: s.capacity };
      else data.slots.push(base);
    }
    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);

    // vždy odošleme fresh zoznam
    const fresh = await readFresh();
    return NextResponse.json({ ok: true, slots: fresh.slots }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/* PATCH – úpravy
   Akceptuje jednu z foriem:
   A) { id?, date?, time?, action: 'delete' | 'lock' | 'unlock' | 'capacity', capacity? }
   B) { date, action: 'lockDay' | 'unlockDay' }
*/
export async function PATCH(req: Request) {
  try {
    const p = await req.json() as
      | { id?: string; date?: string; time?: string; action: 'delete' | 'lock' | 'unlock' | 'capacity'; capacity?: number }
      | { date: string; action: 'lockDay' | 'unlockDay' };

    const data = await readFresh();

    // zamknutie/odomknutie celého dňa
    if (p.action === 'lockDay' || p.action === 'unlockDay') {
      if (!isIsoDate(p.date)) return NextResponse.json({ error: 'Chýba platný date.' }, { status: 400, headers: noCache });
      const lock = p.action === 'lockDay';
      for (const s of data.slots) if (s.date === p.date) s.locked = lock;
      data.updatedAt = new Date().toISOString();
      await writeJson(KEY, data);
      const fresh = await readFresh();
      return NextResponse.json({ ok: true, slots: fresh.slots }, { headers: noCache });
    }

    // single-slot operácie
    if (!('action' in p)) return NextResponse.json({ error: 'Chýba action.' }, { status: 400, headers: noCache });

    // nájdi slot podľa id alebo (date,time)
    let idx = -1;
    if ((p as any).id) {
      idx = data.slots.findIndex(s => s.id === (p as any).id);
    } else if (isIsoDate((p as any).date) && isHm((p as any).time)) {
      idx = findIndex(data.slots, { date: (p as any).date, time: (p as any).time });
    }
    if (idx < 0) {
      return NextResponse.json({ error: 'Slot neexistuje.' }, { status: 404, headers: noCache });
    }

    if (p.action === 'delete') {
      data.slots.splice(idx, 1);
    } else if (p.action === 'lock' || p.action === 'unlock') {
      data.slots[idx].locked = p.action === 'lock';
    } else if (p.action === 'capacity') {
      const safe = Number.isFinite(+p.capacity!) ? Math.max(1, +p.capacity!) : 1;
      data.slots[idx].capacity = safe;
      // necháme bookedCount (už rezervovaní) tak ako je
    }

    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);
    const fresh = await readFresh();
    return NextResponse.json({ ok: true, slots: fresh.slots }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'PATCH /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/* DELETE – úplné vymazanie všetkých slotov */
export async function DELETE() {
  try {
    const empty: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };
    await writeJson(KEY, empty);
    return NextResponse.json({ ok: true, slots: [] }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'DELETE /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}
