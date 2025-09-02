export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = {
  id: string;
  date: string;     // YYYY-MM-DD
  time: string;     // HH:MM
  locked?: boolean;
  booked?: boolean; // legacy flag – nechávame kvôli spätnému čítaniu
  capacity?: number;     // default 1
  bookedCount?: number;  // default 0
};
type SlotsPayload = { slots: Slot[]; updatedAt: string };

const KEY = 'slots.json';
const DEFAULT_SLOTS: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };

const noCache = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function withDefaults(s: Slot): Slot {
  const capacity = s.capacity ?? 1;
  const bookedCount = s.bookedCount ?? (s.booked ? 1 : 0); // ak bolo iba booked=true, interpretuj ako 1/1
  return {
    ...s,
    capacity,
    bookedCount,
    booked: bookedCount >= capacity, // udržujeme konzistenciu
  };
}

async function load(): Promise<SlotsPayload> {
  const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
  data.slots = (data.slots ?? []).map(withDefaults);
  return data;
}

async function save(data: SlotsPayload) {
  data.updatedAt = new Date().toISOString();
  await writeJson(KEY, data);
}

export async function GET() {
  try {
    const data = await load();
    if (!data.slots.length) await save(data);
    return NextResponse.json(data, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'GET /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/** POST – vytvorenie slotov
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

    const data = await load();
    const toCreate: { date: string; time: string; capacity?: number }[] = [];

    if ('slots' in body && Array.isArray(body.slots)) {
      for (const s of body.slots) if (s?.date && s?.time) toCreate.push(s);
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
      const s: Slot = withDefaults({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        date: item.date,
        time: item.time,
        capacity: Math.max(1, item.capacity ?? 1),
        bookedCount: 0,
      });
      data.slots.push(s);
      created.push(s);
    }

    await save(data);
    return NextResponse.json({ ok: true, created }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/** PATCH – úpravy:
 *  - { action:'lock'|'unlock'|'delete', id }
 *  - { action:'setCapacity', id, capacity }
 *  - { action:'lockDay'|'unlockDay', date }
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json() as
      | { action: 'lock'|'unlock'|'delete'; id: string }
      | { action: 'setCapacity'; id: string; capacity: number }
      | { action: 'lockDay'|'unlockDay'; date: string };

    const data = await load();

    if (body.action === 'lock' || body.action === 'unlock' || body.action === 'delete') {
      if (!('id' in body) || !body.id) {
        return NextResponse.json({ error: 'Chýba id' }, { status: 400, headers: noCache });
      }
      if (body.action === 'delete') {
        data.slots = data.slots.filter(s => s.id !== body.id);
      } else {
        const s = data.slots.find(s => s.id === body.id);
        if (!s) return NextResponse.json({ error: 'Slot neexistuje' }, { status: 404, headers: noCache });
        s.locked = body.action === 'lock';
      }
      await save(data);
      return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
    }

    if (body.action === 'setCapacity') {
      const cap = Math.max(1, Math.floor(body.capacity ?? 1));
      const s = data.slots.find(s => s.id === body.id);
      if (!s) return NextResponse.json({ error: 'Slot neexistuje' }, { status: 404, headers: noCache });
      s.capacity = cap;
      // ak už je n plné, zrkadli aj legacy flag
      s.booked = (s.bookedCount ?? 0) >= cap;
      await save(data);
      return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
    }

    if (body.action === 'lockDay' || body.action === 'unlockDay') {
      if (!body.date) {
        return NextResponse.json({ error: 'Chýba date' }, { status: 400, headers: noCache });
      }
      const lockVal = body.action === 'lockDay';
      data.slots.forEach(s => {
        if (s.date === body.date) s.locked = lockVal;
      });
      await save(data);
      return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
    }

    return NextResponse.json({ error: 'Neznáma akcia' }, { status: 400, headers: noCache });
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
