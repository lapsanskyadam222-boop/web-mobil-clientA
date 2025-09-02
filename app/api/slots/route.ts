// app/api/slots/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = {
  id: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  locked?: boolean;
  booked?: boolean;      // zostáva kvôli starej klient logike
  capacity?: number;     // max počet rezervácií (default 1)
  bookedCount?: number;  // počet prijatých rezervácií (pre rýchle UI)
};

type SlotsPayload = { slots: Slot[]; updatedAt: string };

const KEY = 'slots.json';
const DEFAULT_SLOTS: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };

const noCache = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function normalizeSlot(s: Slot): Slot {
  const capacity = typeof s.capacity === 'number' && s.capacity > 0 ? s.capacity : 1;
  const bookedCount = Math.max(0, s.bookedCount ?? 0);
  const booked = bookedCount >= capacity ? true : (s.booked ?? false);
  return { ...s, capacity, bookedCount, booked };
}

export async function GET() {
  try {
    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
    if (!data.slots.length) {
      await writeJson(KEY, data);
    } else {
      // normalizácia (pre staré záznamy bez capacity/bookedCount)
      data.slots = data.slots.map(normalizeSlot);
    }
    return NextResponse.json(data, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'GET /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/** POST:
 *  - {date,time,capacity?}     -> 1 slot
 *  - {date,times[],capacity?}  -> viac časov pre deň
 *  - {slots:[{date,time,capacity?},...]} -> všeobecne
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
      const capacity = typeof item.capacity === 'number' && item.capacity > 0 ? item.capacity : 1;
      const newSlot: Slot = normalizeSlot({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        date: item.date,
        time: item.time,
        capacity,
        bookedCount: 0,
        booked: false,
      });
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
    const { id, action, capacity } = (await req.json()) as {
      id?: string;
      action?: 'lock' | 'unlock' | 'delete' | 'setCapacity';
      capacity?: number;
    };
    if (!id || !action) return NextResponse.json({ error: 'Chýba id alebo action' }, { status: 400, headers: noCache });

    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
    const slotIdx = data.slots.findIndex(s => s.id === id);

    if (action !== 'delete' && slotIdx === -1) {
      return NextResponse.json({ error: 'Slot neexistuje' }, { status: 404, headers: noCache });
    }

    if (action === 'delete') {
      data.slots = data.slots.filter(s => s.id !== id);
    } else {
      const slot = normalizeSlot(data.slots[slotIdx]);

      if (action === 'lock') slot.locked = true;
      if (action === 'unlock') slot.locked = false;
      if (action === 'setCapacity') {
        const cap = typeof capacity === 'number' && capacity > 0 ? Math.floor(capacity) : 1;
        slot.capacity = cap;
        // ak je už obsadených viac, než nová kapacita, označíme booked=true
        slot.booked = (slot.bookedCount ?? 0) >= cap;
      }

      data.slots[slotIdx] = normalizeSlot(slot);
    }

    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);

    // vrátime celý zoznam ako autoritu
    return NextResponse.json({ ok: true, slots: data.slots.map(normalizeSlot) }, { headers: noCache });
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
