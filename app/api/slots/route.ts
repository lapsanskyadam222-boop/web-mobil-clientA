// app/api/slots/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = {
  id: string;
  date: string;   // 'YYYY-MM-DD'
  time: string;   // 'HH:mm'
  locked?: boolean;
  booked?: boolean;
  capacity?: number;      // default 1
  bookedCount?: number;   // default 0
};

type SlotsPayload = { slots: Slot[]; updatedAt: string };

const KEY = 'slots.json';
const EMPTY: SlotsPayload = { slots: [], updatedAt: new Date(0).toISOString() };

const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function makeId(date: string, time: string) {
  return `${date}_${time}`.replace(/[^0-9:_-]/g, '');
}
function normCap(n?: number) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 1;
}
function byDateTime(a: Slot, b: Slot) {
  if (a.date === b.date) return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
  return a.date < b.date ? -1 : 1;
}
function findIndexById(slots: Slot[], id?: string) {
  return id ? slots.findIndex(s => s.id === id) : -1;
}
function findIndexByDateTime(slots: Slot[], date?: string, time?: string) {
  if (!date || !time) return -1;
  return slots.findIndex(s => s.date === date && s.time === time);
}

async function readData(): Promise<SlotsPayload> {
  const data = await readJson<SlotsPayload>(KEY, EMPTY);
  return {
    slots: Array.isArray(data.slots) ? data.slots : [],
    updatedAt: data.updatedAt || new Date(0).toISOString(),
  };
}

async function writeData(data: SlotsPayload) {
  data.updatedAt = new Date().toISOString();
  await writeJson(KEY, data);
  // vždy vrátime čerstvo načítané (po verifikácii v writeJson)
  return await readJson<SlotsPayload>(KEY, EMPTY);
}

/** GET – vráť všetky sloty */
export async function GET() {
  try {
    const data = await readData();
    return NextResponse.json(data, { headers: noCacheHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'GET /slots zlyhalo' }, { status: 500, headers: noCacheHeaders });
  }
}

/** POST – vytvor/overwrite sloty
 *  Body:
 *   - { slots: [{date, time, capacity?}, ...] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const incoming: { date?: string; time?: string; capacity?: number }[] =
      Array.isArray(body?.slots) ? body.slots : [];

    if (!incoming.length) {
      return NextResponse.json({ error: 'Chýba slots[]' }, { status: 400, headers: noCacheHeaders });
    }

    const data = await readData();

    for (const s of incoming) {
      if (!s?.date || !s?.time) continue;

      const cap = normCap(s.capacity);
      const idx = findIndexByDateTime(data.slots, s.date, s.time);
      const base: Slot = {
        id: makeId(s.date, s.time),
        date: s.date,
        time: s.time,
        locked: false,
        booked: false,
        capacity: cap,
        bookedCount: 0,
      };

      if (idx >= 0) {
        // overwrite existujúceho (bezpečné „pridaj znova“)
        data.slots[idx] = {
          ...data.slots[idx],
          ...base,
          // zachovej booked/bookedCount ak existujú
          booked: data.slots[idx]?.booked ?? false,
          bookedCount: data.slots[idx]?.bookedCount ?? 0,
        };
      } else {
        data.slots.push(base);
      }
    }

    data.slots.sort(byDateTime);

    const fresh = await writeData(data);
    return NextResponse.json({ ok: true, slots: fresh.slots }, { headers: noCacheHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots zlyhalo' }, { status: 500, headers: noCacheHeaders });
  }
}

/** PATCH – zmeny
 * Single slot:
 *  { id? , date?, time?, action: 'delete'|'lock'|'unlock'|'capacity', capacity? }
 * Deň:
 *  { date, action: 'lockDay'|'unlockDay' }
 */
export async function PATCH(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const data = await readData();

    // Lock/Unlock celého dňa
    if (payload?.date && (payload?.action === 'lockDay' || payload?.action === 'unlockDay')) {
      const lock = payload.action === 'lockDay';
      for (const s of data.slots) if (s.date === payload.date) s.locked = lock;
      const fresh = await writeData(data);
      return NextResponse.json({ ok: true, slots: fresh.slots }, { headers: noCacheHeaders });
    }

    // single-slot operácie
    const idx =
      findIndexById(data.slots, payload?.id) >= 0
        ? findIndexById(data.slots, payload?.id)
        : findIndexByDateTime(data.slots, payload?.date, payload?.time);

    if (idx < 0) {
      return NextResponse.json({ error: 'Slot neexistuje' }, { status: 404, headers: noCacheHeaders });
    }

    const s = data.slots[idx];

    if (payload?.action === 'delete') {
      data.slots.splice(idx, 1);
    } else if (payload?.action === 'lock') {
      s.locked = true;
    } else if (payload?.action === 'unlock') {
      s.locked = false;
    } else if (payload?.action === 'capacity') {
      s.capacity = normCap(payload?.capacity);
      if (!Number.isFinite(s.bookedCount)) s.bookedCount = 0;
      if (s.bookedCount! > s.capacity!) s.bookedCount = s.capacity!;
      s.booked = (s.bookedCount ?? 0) >= (s.capacity ?? 1);
    } else {
      return NextResponse.json({ error: 'Neznáma action' }, { status: 400, headers: noCacheHeaders });
    }

    data.slots.sort(byDateTime);

    const fresh = await writeData(data);
    return NextResponse.json({ ok: true, slots: fresh.slots }, { headers: noCacheHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'PATCH /slots zlyhalo' }, { status: 500, headers: noCacheHeaders });
  }
}

/** DELETE – vymaž všetko */
export async function DELETE() {
  try {
    const empty: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };
    await writeJson(KEY, empty);
    const fresh = await readJson<SlotsPayload>(KEY, EMPTY);
    return NextResponse.json({ ok: true, slots: fresh.slots }, { headers: noCacheHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'DELETE /slots zlyhalo' }, { status: 500, headers: noCacheHeaders });
  }
}
