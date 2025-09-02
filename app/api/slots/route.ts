// app/api/slots/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = {
  id: string;
  date: string;
  time: string;
  locked?: boolean;
  booked?: boolean;
  capacity?: number;
  bookedCount?: number;
};
type SlotsPayload = { slots: Slot[]; updatedAt: string };

const KEY = 'slots.json';
const DEFAULT_SLOTS: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };

const noCache = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  try {
    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
    if (!data.slots.length) await writeJson(KEY, data);
    return NextResponse.json(data, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'GET /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/** POST:
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

    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
    const toCreate: { date: string; time: string; capacity?: number }[] = [];

    if ('slots' in body && Array.isArray(body.slots)) {
      for (const s of body.slots) if (s?.date && s?.time) toCreate.push({ date: s.date, time: s.time, capacity: s.capacity });
    } else if ('times' in body && body.date) {
      for (const t of (body.times ?? [])) if (t) toCreate.push({ date: body.date, time: t, capacity: body.capacity });
    } else if ('date' in body && 'time' in body && body.date && body.time) {
      toCreate.push({ date: body.date, time: body.time, capacity: body.capacity });
    }

    if (!toCreate.length) {
      return NextResponse.json({ error: 'Chýba date/time alebo times/slots.' }, { status: 400, headers: noCache });
    }

    const created: Slot[] = [];
    for (const item of toCreate) {
      const newSlot: Slot = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        date: item.date,
        time: item.time,
        capacity: (typeof item.capacity === 'number' && item.capacity >= 1) ? Math.floor(item.capacity) : undefined,
      };
      data.slots.push(newSlot);
      created.push(newSlot);
    }

    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);

    return NextResponse.json({ ok: true, created }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

export async function PATCH(req: Request) {
  try {
    const payload = await req.json();
    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);

    // 1) operácie nad jedným slotom
    if (payload?.id && typeof payload.id === 'string' && payload?.action) {
      const slot = data.slots.find(s => s.id === payload.id);
      if (!slot && payload.action !== 'delete') {
        return NextResponse.json({ error: 'Slot neexistuje' }, { status: 404, headers: noCache });
      }

      if (payload.action === 'lock' && slot) slot.locked = true;
      if (payload.action === 'unlock' && slot) slot.locked = false;
      if (payload.action === 'delete') data.slots = data.slots.filter(s => s.id !== payload.id);

      if (payload.action === 'setCapacity') {
        const n = Math.max(1, Math.floor(payload?.capacity ?? 0));
        if (!Number.isFinite(n)) {
          return NextResponse.json({ error: 'Neplatná kapacita.' }, { status: 400, headers: noCache });
        }
        if (slot) slot.capacity = n;
      }

      data.updatedAt = new Date().toISOString();
      await writeJson(KEY, data);
      return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
    }

    // 2) lock/unlock celého dňa
    if (payload?.date && typeof payload.date === 'string' &&
        (payload?.action === 'lockDay' || payload?.action === 'unlockDay')) {
      const lock = payload.action === 'lockDay';
      for (const s of data.slots) {
        if (s.date === payload.date) s.locked = lock;
      }
      data.updatedAt = new Date().toISOString();
      await writeJson(KEY, data);
      return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
    }

    return NextResponse.json({ error: 'Neplatná požiadavka.' }, { status: 400, headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'PATCH /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

export async function DELETE() {
  try {
    const empty: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };
    await writeJson(KEY, empty);
    return NextResponse.json({ ok: true, slots: [] }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'DELETE /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}
