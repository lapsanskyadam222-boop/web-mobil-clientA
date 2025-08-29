// app/api/slots/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };
type SlotsPayload = { slots: Slot[]; updatedAt: string };

const KEY = 'slots.json';
const DEFAULT_SLOTS: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };

export async function GET() {
  try {
    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
    if (!data.slots.length) await writeJson(KEY, data);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'GET /slots zlyhalo' }, { status: 500 });
  }
}

/**
 * POST /api/slots
 * - Jednotlivý slot:        { date: "YYYY-MM-DD", time: "HH:MM" }
 * - Hromadné pridanie časov: { date: "YYYY-MM-DD", times: ["HH:MM","HH:MM", ...] }
 * - (voliteľne) úplný zoznam: { slots: [{date,time}, ...] }
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
      for (const s of body.slots) {
        if (s?.date && s?.time) toCreate.push({ date: s.date, time: s.time });
      }
    } else if ('times' in body && body.date) {
      for (const t of (body.times ?? [])) {
        if (t) toCreate.push({ date: body.date, time: t });
      }
    } else if ('date' in body && 'time' in body && body.date && body.time) {
      toCreate.push({ date: body.date, time: body.time });
    }

    if (!toCreate.length) {
      return NextResponse.json({ error: 'Chýba date/time alebo times/slots.' }, { status: 400 });
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

    return NextResponse.json({ ok: true, created }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots zlyhalo' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, action } = (await req.json()) as { id?: string; action?: 'lock' | 'unlock' | 'delete' };
    if (!id || !action) return NextResponse.json({ error: 'Chýba id alebo action' }, { status: 400 });

    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
    const slot = data.slots.find(s => s.id === id);

    if (action !== 'delete' && !slot) return NextResponse.json({ error: 'Slot neexistuje' }, { status: 404 });

    if (action === 'lock' && slot) slot.locked = true;
    if (action === 'unlock' && slot) slot.locked = false;
    if (action === 'delete') data.slots = data.slots.filter(s => s.id !== id);

    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);

    return NextResponse.json({ ok: true, slots: data.slots }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'PATCH /slots zlyhalo' }, { status: 500 });
  }
}

// 🗑️ Vymazať všetky sloty
export async function DELETE() {
  try {
    const empty: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };
    await writeJson(KEY, empty);
    return NextResponse.json({ ok: true, slots: [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'DELETE /slots zlyhalo' }, { status: 500 });
  }
}
