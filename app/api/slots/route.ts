// app/api/slots/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };
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
 *  - {date,time}     -> 1 slot
 *  - {date,times[]}  -> viac časov pre deň
 *  - {slots:[{date,time},...]} -> všeobecne
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as
      | { date?: string; time?: string }
      | { date?: string; times?: string[] }
      | { slots?: { date: string; time: string }[] };

    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
    const toCreate: { date: string; time: string }[] = [];

    if ('slots' in body && Array.isArray(body.slots)) {
      for (const s of body.slots) if (s?.date && s?.time) toCreate.push({ date: s.date, time: s.time });
    } else if ('times' in body && body.date) {
      for (const t of (body.times ?? [])) if (t) toCreate.push({ date: body.date, time: t });
    } else if ('date' in body && 'time' in body && body.date && body.time) {
      toCreate.push({ date: body.date, time: body.time });
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
    const { id, action } = (await req.json()) as { id?: string; action?: 'lock' | 'unlock' | 'delete' };
    if (!id || !action) return NextResponse.json({ error: 'Chýba id alebo action' }, { status: 400, headers: noCache });

    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
    const slot = data.slots.find(s => s.id === id);

    if (action !== 'delete' && !slot) return NextResponse.json({ error: 'Slot neexistuje' }, { status: 404, headers: noCache });

    if (action === 'lock' && slot) slot.locked = true;
    if (action === 'unlock' && slot) slot.locked = false;
    if (action === 'delete') data.slots = data.slots.filter(s => s.id !== id);

    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);

    // vrátime celý zoznam ako autoritu
    return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
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
