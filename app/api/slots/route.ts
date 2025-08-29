// app/api/slots/route.ts
import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };
type SlotsPayload = { slots: Slot[]; updatedAt: string };

const DEFAULT_SLOTS: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };
const KEY = 'slots.json';

export async function GET() {
  const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
  if (!data.slots.length) await writeJson(KEY, DEFAULT_SLOTS);
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

// ➕ Pridať slot
export async function POST(req: Request) {
  const body = await req.json();
  const { date, time } = body as { date?: string; time?: string };
  if (!date || !time) return NextResponse.json({ error: 'Chýba dátum alebo čas' }, { status: 400 });

  const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
  const newSlot: Slot = { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, date, time };
  data.slots.push(newSlot);
  data.updatedAt = new Date().toISOString();
  await writeJson(KEY, data);

  return NextResponse.json({ ok: true, slot: newSlot });
}

// 🔒 Zmeniť stav alebo vymazať slot
export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, action } = body as { id?: string; action?: 'lock' | 'unlock' | 'delete' };
  if (!id || !action) return NextResponse.json({ error: 'Chýba id alebo action' }, { status: 400 });

  const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
  const slot = data.slots.find(s => s.id === id);
  if (!slot) return NextResponse.json({ error: 'Slot neexistuje' }, { status: 404 });

  if (action === 'lock') slot.locked = true;
  if (action === 'unlock') slot.locked = false;
  if (action === 'delete') data.slots = data.slots.filter(s => s.id !== id);

  data.updatedAt = new Date().toISOString();
  await writeJson(KEY, data);

  return NextResponse.json({ ok: true, slots: data.slots });
}
