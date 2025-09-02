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
  booked?: boolean;     // pôvodné pole
  capacity?: number;    // novšie pole
  bookedCount?: number; // novšie pole
};
type SlotsPayload = { slots: Slot[]; updatedAt: string };

const KEY = 'slots.json';
const noCache = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

/** vytvor deterministické ID ak chýba */
function makeId(s: { date: string; time: string }) {
  // jednoduché „stabilné“ id; ak by už taký existoval duplicitne, pridá sa suffix
  return `S_${s.date}_${s.time}`.replace(/[^A-Za-z0-9_]/g, '');
}

/** migrácia/staré dáta → doplniť id/capacity/bookedCount a odstrániť duplicity (podľa date+time) */
function normalizeSlots(raw: any[]): Slot[] {
  const seen = new Map<string, Slot>(); // kľúč = date|time
  for (const x of raw ?? []) {
    if (!x?.date || !x?.time) continue;
    const k = `${x.date}|${x.time}`;
    const cap = Number.isFinite(+x.capacity) ? Math.max(1, +x.capacity) : 1;
    const bc  = Number.isFinite(+x.bookedCount) ? Math.max(0, +x.bookedCount) : (x.booked ? 1 : 0);

    // ak chýba id, vyrob
    let id = x.id || makeId(x);
    // na istotu: ak by zrovna existovalo viac rovnakých id, sprav suffix
    while ([...seen.values()].some(v => v.id === id)) {
      id += '_' + Math.random().toString(36).slice(2, 5);
    }

    seen.set(k, {
      id,
      date: String(x.date),
      time: String(x.time),
      locked: !!x.locked,
      booked: !!x.booked,
      capacity: cap,
      bookedCount: bc,
    });
  }
  return [...seen.values()];
}

/** nájdi index slotu podľa id alebo (date,time) */
function findIndex(slots: Slot[], payload: { id?: string; date?: string; time?: string }) {
  if (payload.id) {
    const i = slots.findIndex(s => s.id === payload.id);
    if (i !== -1) return i;
  }
  if (payload.date && payload.time) {
    const i = slots.findIndex(s => s.date === payload.date && s.time === payload.time);
    if (i !== -1) return i;
  }
  return -1;
}

async function readNormalized(): Promise<SlotsPayload> {
  const data = await readJson<SlotsPayload>(KEY, { slots: [], updatedAt: new Date().toISOString() });
  const normalized = normalizeSlots(data.slots);
  if (normalized.length !== data.slots.length ||
      normalized.some((s, i) =>
        !data.slots[i] ||
        s.id !== (data.slots[i] as any).id ||
        (s.capacity ?? 1) !== (data.slots[i] as any).capacity ||
        (s.bookedCount ?? 0) !== (data.slots[i] as any).bookedCount
      )) {
    // niečo sa opravilo → ulož späť
    const fixed: SlotsPayload = { slots: normalized, updatedAt: new Date().toISOString() };
    await writeJson(KEY, fixed);
    return fixed;
  }
  return { slots: normalized, updatedAt: data.updatedAt || new Date().toISOString() };
}

export async function GET() {
  try {
    const data = await readNormalized();
    return NextResponse.json(data, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'GET /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { slots?: { date: string; time: string; capacity?: number }[] };
    const toAdd = (body.slots ?? []).filter(s => s?.date && s?.time);
    if (!toAdd.length) {
      return NextResponse.json({ error: 'Chýba slots[]' }, { status: 400, headers: noCache });
    }

    const data = await readNormalized();
    for (const s of toAdd) {
      const cap = Number.isFinite(+s.capacity) ? Math.max(1, +s.capacity!) : 1;
      const id = makeId(s);
      // ak už existuje rovnaký (date,time), prepíš (aby sa dali ľahko „pridať znova“)
      const idx = findIndex(data.slots, { date: s.date, time: s.time });
      const slot: Slot = {
        id: idx === -1 ? id : data.slots[idx].id,
        date: s.date,
        time: s.time,
        locked: false,
        booked: false,
        capacity: cap,
        bookedCount: 0,
      };
      if (idx === -1) data.slots.push(slot);
      else data.slots[idx] = slot;
    }

    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);
    return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

export async function PATCH(req: Request) {
  try {
    const payload = await req.json() as
      | { id?: string; date?: string; time?: string; action?: 'lock'|'unlock'|'delete'|'capacity'; capacity?: number }
      | { date?: string; action?: 'lockDay'|'unlockDay' };

    const data = await readNormalized();

    // lock/unlock celý deň
    if (payload.date && (payload as any).action && ((payload as any).action === 'lockDay' || (payload as any).action === 'unlockDay')) {
      const lock = (payload as any).action === 'lockDay';
      for (const s of data.slots) if (s.date === payload.date) s.locked = lock;
      data.updatedAt = new Date().toISOString();
      await writeJson(KEY, data);
      return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
    }

    // operácia na konkrétnom slote
    const idx = findIndex(
      data.slots,
      { id: (payload as any).id, date: (payload as any).date, time: (payload as any).time }
    );
    if (idx === -1) {
      return NextResponse.json({ error: 'Slot neexistuje (id/date/time mismatch)' }, { status: 404, headers: noCache });
    }

    const action = (payload as any).action as 'lock'|'unlock'|'delete'|'capacity'|undefined;
    if (!action) {
      return NextResponse.json({ error: 'Chýba action' }, { status: 400, headers: noCache });
    }

    if (action === 'lock')   data.slots[idx].locked = true;
    if (action === 'unlock') data.slots[idx].locked = false;
    if (action === 'delete') data.slots.splice(idx, 1);
    if (action === 'capacity') {
      const c = Number.isFinite(+((payload as any).capacity)) ? Math.max(1, +((payload as any).capacity)) : 1;
      data.slots[idx].capacity = c;
      // ak máš logiku na booked/bookedCount, ponechávam
    }

    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);
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
