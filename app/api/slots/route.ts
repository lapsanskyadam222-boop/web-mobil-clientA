// app/api/slots/route.ts
import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };
type SlotsPayload = { slots: Slot[]; updatedAt: string };

const KEY = 'slots.json';
const DEFAULT_SLOTS: SlotsPayload = {
  slots: [],
  updatedAt: new Date().toISOString(),
};

export async function GET() {
  try {
    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
    if (!data.slots.length) {
      await writeJson(KEY, DEFAULT_SLOTS);
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'GET /slots zlyhalo' }, { status: 500 });
  }
}

// ➕ Pridať slot
export async function POST(req: Request) {
  try {
    const { date, time } = (await req.json()) as { date?: string; time?: string };
    if (!date || !time) return NextResponse.json({ error: 'Chýba dátum alebo čas' }, { status: 400 });

    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
    const newSlot: Slot = { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, date, time };
    data.slots.push(newSlot);
    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);

    return NextResponse.json({ ok: true, slot: newSlot });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots zlyhalo' }, { status: 500 });
  }
}

// 🔒 Zamknúť/odomknúť/vymazať slot
export async function PATCH(req: Request) {
  try {
    const { id, action } = (await req.json()) as { id?: string; action?: 'lock' | 'unlock' | 'delete' };
    if (!id || !action) return NextResponse.json({ error: 'Chýba id alebo action' }, { status: 400 });

    const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
    const slot = data.slots.find((s) => s.id === id);
    if (!slot && action !== 'delete') return NextResponse.json({ error: 'Slot neexistuje' }, { status: 404 });

    if (action === 'lock' && slot) slot.locked = true;
    if (action === 'unlock' && slot) slot.locked = false;
    if (action === 'delete') data.slots = data.slots.filter((s) => s.id !== id);

    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);

    return NextResponse.json({ ok: true, slots: data.slots });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'PATCH /slots zlyhalo' }, { status: 500 });
  }
}
