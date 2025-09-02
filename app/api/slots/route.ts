export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = {
  id: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  locked?: boolean;
  booked?: boolean;
  capacity?: number;     // default 1
  bookedCount?: number;  // default 0
};
type SlotsPayload = { slots: Slot[]; updatedAt: string };

const KEY = 'slots.json';
const DEFAULT: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };

const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function stamp(data: SlotsPayload) {
  data.updatedAt = new Date().toISOString();
}

export async function GET() {
  try {
    const data = await readJson<SlotsPayload>(KEY, DEFAULT);
    return NextResponse.json({ slots: data.slots, updatedAt: data.updatedAt }, { headers: noCacheHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'GET /slots failed' }, { status: 500, headers: noCacheHeaders });
  }
}

/** Vytvorenie slotov
 *  - {date,time,capacity?}
 *  - {date,times[],capacity?}
 *  - {slots:[{date,time,capacity?},...]}
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as
      | { date?: string; time?: string; capacity?: number }
      | { date?: string; times?: string[]; capacity?: number }
      | { slots?: { date: string; time: string; capacity?: number }[] };

    const data = await readJson<SlotsPayload>(KEY, DEFAULT);
    const toCreate: { date: string; time: string; capacity?: number }[] = [];

    if ('slots' in body && Array.isArray(body.slots)) {
      for (const s of body.slots) if (s?.date && s?.time) toCreate.push({ date: s.date, time: s.time, capacity: s.capacity });
    } else if ('times' in body && body.date) {
      for (const t of (body.times ?? [])) if (t) toCreate.push({ date: body.date, time: t, capacity: body.capacity });
    } else if ('date' in body && 'time' in body && body.date && body.time) {
      toCreate.push({ date: body.date, time: body.time, capacity: body.capacity });
    } else {
      return NextResponse.json({ error: 'Chýba date/time alebo times/slots.' }, { status: 400, headers: noCacheHeaders });
    }

    const created: Slot[] = [];
    for (const s of toCreate) {
      const newSlot: Slot = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        date: s.date,
        time: s.time,
        capacity: typeof s.capacity === 'number' && s.capacity > 0 ? Math.floor(s.capacity) : 1,
        bookedCount: 0,
      };
      data.slots.push(newSlot);
      created.push(newSlot);
    }
    stamp(data);
    await writeJson(KEY, data);

    return NextResponse.json({ ok: true, created, slots: data.slots }, { headers: noCacheHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots failed' }, { status: 500, headers: noCacheHeaders });
  }
}

/** Úpravy:
 *  - { id, action: 'lock'|'unlock'|'delete' }
 *  - { id, action: 'setCapacity', capacity }
 *  - { action: 'lockDay'|'unlockDay', date }
 */
export async function PATCH(req: Request) {
  try {
    const payload = await req.json();

    const data = await readJson<SlotsPayload>(KEY, DEFAULT);

    // lock/unlock/delete slot
    if (payload?.id && payload?.action) {
      const slot = data.slots.find(s => s.id === payload.id);
      if (!slot && payload.action !== 'delete') {
        return NextResponse.json({ error: 'Slot neexistuje' }, { status: 404, headers: noCacheHeaders });
      }
      switch (payload.action) {
        case 'lock':
          slot!.locked = true;
          break;
        case 'unlock':
          slot!.locked = false;
          break;
        case 'setCapacity': {
          const n = Number(payload.capacity);
          slot!.capacity = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
          if (typeof slot!.bookedCount !== 'number') slot!.bookedCount = 0;
          if (slot!.bookedCount > (slot!.capacity ?? 1)) slot!.bookedCount = slot!.capacity!;
          break;
        }
        case 'delete':
          data.slots = data.slots.filter(s => s.id !== payload.id);
          break;
        default:
          return NextResponse.json({ error: 'Neplatná action' }, { status: 400, headers: noCacheHeaders });
      }
      stamp(data);
      await writeJson(KEY, data);
      return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCacheHeaders });
    }

    // lock/unlock celý deň
    if (payload?.action && (payload.action === 'lockDay' || payload.action === 'unlockDay') && typeof payload?.date === 'string') {
      const lock = payload.action === 'lockDay';
      for (const s of data.slots) {
        if (s.date === payload.date) s.locked = lock;
      }
      stamp(data);
      await writeJson(KEY, data);
      return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCacheHeaders });
    }

    return NextResponse.json({ error: 'Neplatná požiadavka.' }, { status: 400, headers: noCacheHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'PATCH /slots failed' }, { status: 500, headers: noCacheHeaders });
  }
}

export async function DELETE() {
  try {
    const empty: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };
    await writeJson(KEY, empty);
    return NextResponse.json({ ok: true, slots: [] }, { headers: noCacheHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'DELETE /slots failed' }, { status: 500, headers: noCacheHeaders });
  }
}
