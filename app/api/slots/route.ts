export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';

/** ====== Typy ====== */
type Slot = {
  id: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  locked?: boolean;
  booked?: boolean;
  capacity?: number;   // min 1, default 1
  bookedCount?: number;
};
type SlotsPayload = { slots: Slot[]; updatedAt: string };

const KEY = 'slots.json';

/** ====== No-cache hlavičky ====== */
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
} as const;

/** ====== pomocné ====== */
function makeId(s: { date: string; time: string }) {
  return `${s.date}T${s.time}`;
}
function isIsoDate(x: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(x);
}
function isHm(x: string) {
  return /^\d{2}:\d{2}$/.test(x);
}
function findIndex(slots: Slot[], q: { date: string; time: string }) {
  return slots.findIndex((s) => s.date === q.date && s.time === q.time);
}

async function read(): Promise<SlotsPayload> {
  try {
    const { blobs } = await list({ prefix: KEY });
    const entry = blobs.find(b => b.pathname === KEY || b.url.endsWith('/' + KEY)) ?? blobs[0];
    if (!entry) return { slots: [], updatedAt: new Date().toISOString() };

    const res = await fetch(`${entry.url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return { slots: [], updatedAt: new Date().toISOString() };
    return (await res.json()) as SlotsPayload;
  } catch {
    return { slots: [], updatedAt: new Date().toISOString() };
  }
}

async function write(data: SlotsPayload) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN chýba vo Verceli.');
  await put(KEY, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    token,
  });
}

/** ====== GET ====== */
export async function GET() {
  const data = await read();
  return NextResponse.json(data, { headers: noCacheHeaders });
}

/** ====== POST
 *  Akceptuje:
 *   - { date, time, capacity? }
 *   - { slots: [{date,time,capacity?}, ...] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as
      | { date?: string; time?: string; capacity?: number }
      | { slots?: { date: string; time: string; capacity?: number }[] };

    const toAdd: { date: string; time: string; capacity?: number }[] = [];

    if ('slots' in body && Array.isArray(body.slots)) {
      for (const s of body.slots) {
        if (s?.date && s?.time && isIsoDate(s.date) && isHm(s.time)) {
          toAdd.push({ date: s.date, time: s.time, capacity: s.capacity });
        }
      }
    } else if ('date' in body && 'time' in body && body.date && body.time && isIsoDate(body.date) && isHm(body.time)) {
      toAdd.push({ date: body.date, time: body.time, capacity: body.capacity });
    }

    if (!toAdd.length) {
      return NextResponse.json({ error: 'Chýba slots[] alebo (date,time).' }, { status: 400, headers: noCacheHeaders });
    }

    const data = await read();

    for (const it of toAdd) {
      const cap = Number.isFinite(+it.capacity!) ? Math.max(1, +it.capacity!) : 1;
      const idx = findIndex(data.slots, { date: it.date, time: it.time });
      const base: Slot = {
        id: makeId(it),
        date: it.date,
        time: it.time,
        locked: false,
        booked: false,
        capacity: cap,
        bookedCount: 0,
      };
      if (idx >= 0) {
        // prepíš existujúci (aby sa dalo “pridať znova”)
        const prev = data.slots[idx];
        data.slots[idx] = { ...base, booked: !!prev.booked, bookedCount: prev.bookedCount ?? 0, locked: !!prev.locked };
      } else {
        data.slots.push(base);
      }
    }

    data.updatedAt = new Date().toISOString();
    await write(data);

    // vrátime čerstvý stav
    const fresh = await read();
    return NextResponse.json(fresh, { headers: noCacheHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots zlyhalo' }, { status: 500, headers: noCacheHeaders });
  }
}

/** ====== PATCH
 *  Akceptuje:
 *   - { id, action:'delete' }
 *   - { id, date, time, action:'lock'|'unlock' }
 *   - { id, date, time, action:'capacity', capacity:number }
 *   - { date, action:'lockDay'|'unlockDay' }
 */
export async function PATCH(req: Request) {
  try {
    const p = await req.json() as
      | { id?: string; date?: string; time?: string; action?: 'delete' | 'lock' | 'unlock' | 'capacity'; capacity?: number }
      | { date?: string; action?: 'lockDay' | 'unlockDay' };

    const data = await read();

    // zamkni/odomkni celý deň
    if ('action' in p && (p.action === 'lockDay' || p.action === 'unlockDay') && p.date && isIsoDate(p.date)) {
      const lock = p.action === 'lockDay';
      for (const s of data.slots) if (s.date === p.date) s.locked = lock;
      data.updatedAt = new Date().toISOString();
      await write(data);
      const fresh = await read();
      return NextResponse.json(fresh, { headers: noCacheHeaders });
    }

    // single slot operácie
    if (!p.action) {
      return NextResponse.json({ error: 'Chýba action.' }, { status: 400, headers: noCacheHeaders });
    }

    // nájdi cez id alebo (date,time)
    let idx = -1;
    if (p.id) {
      idx = data.slots.findIndex(s => s.id === p.id);
    } else if (p.date && p.time && isIsoDate(p.date) && isHm(p.time)) {
      idx = findIndex(data.slots, { date: p.date, time: p.time });
    }
    if (idx < 0) {
      return NextResponse.json({ error: 'Slot neexistuje.' }, { status: 404, headers: noCacheHeaders });
    }

    if (p.action === 'delete') {
      data.slots.splice(idx, 1);
    } else if (p.action === 'lock' || p.action === 'unlock') {
      data.slots[idx].locked = p.action === 'lock';
    } else if (p.action === 'capacity') {
      const safe = Number.isFinite(+p.capacity!) ? Math.max(1, Math.round(+p.capacity!)) : 1;
      data.slots[idx].capacity = safe;
      // neprepíš bookedCount, booked atď.
    }

    data.updatedAt = new Date().toISOString();
    await write(data);

    const fresh = await read();
    return NextResponse.json(fresh, { headers: noCacheHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'PATCH /slots zlyhalo' }, { status: 500, headers: noCacheHeaders });
  }
}

/** ====== DELETE – úplne vymaž všetko ====== */
export async function DELETE() {
  try {
    const empty: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };
    await write(empty);
    const fresh = await read();
    return NextResponse.json(fresh, { headers: noCacheHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'DELETE /slots zlyhalo' }, { status: 500, headers: noCacheHeaders });
  }
}
