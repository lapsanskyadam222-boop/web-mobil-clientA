export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

/* ===== Typy ===== */

export type Slot = {
  id: string;
  date: string;     // YYYY-MM-DD
  time: string;     // HH:mm
  locked?: boolean; // admin lock
  booked?: boolean; // obsadený (jedno-miesto režim)
  capacity?: number;     // max počet ľudí (>=1)
  bookedCount?: number;  // aktuálne rezervovaných (0..capacity)
};

type SlotsPayload = {
  slots: Slot[];
  updatedAt: string; // ISO
};

/* ===== Konštanty ===== */

const KEY = 'slots.json';
const DEFAULT: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };

const noCache = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

/* ===== Pomocné ===== */

const byDateTime = (s: Slot, date: string, time: string) =>
  s.date === date && s.time === time;

const makeId = (date: string, time: string) =>
  `${date}T${time}`.replace(/[:\-]/g, '');

/* ====================================================================== */
/* GET: vráti všetky sloty                                                */
/* ====================================================================== */
export async function GET() {
  try {
    const data = await readJson<SlotsPayload>(KEY, DEFAULT);
    // ak neexistuje, ulož prázdny objekt (aby vznikol blob)
    if (!Array.isArray(data.slots)) {
      const fixed: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };
      await writeJson(KEY, fixed);
      return NextResponse.json(fixed, { headers: noCache });
    }
    return NextResponse.json(data, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'GET /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/* ====================================================================== */
/* POST: pridanie slotov                                                  */
/* Akceptuje 3 tvary payloadu:                                            */
/* 1) { date, time, capacity? }                                           */
/* 2) { date, times: string[], capacity? }                                */
/* 3) { slots: [{ date, time, capacity? }, ...] }                         */
/* ====================================================================== */
export async function POST(req: Request) {
  try {
    type InOne = { date?: string; time?: string; capacity?: number };
    type InMany = { date?: string; times?: string[]; capacity?: number };
    type InBody = InOne | InMany | { slots?: InOne[] };

    const body = (await req.json()) as InBody;
    const data = await readJson<SlotsPayload>(KEY, DEFAULT);

    const toAdd: { date: string; time: string; capacity: number }[] = [];

    const pushOne = (date?: string, time?: string, capacity?: number) => {
      if (!date || !time) return;
      const cap = Number.isFinite(+capacity!) ? Math.max(1, +capacity!) : 1;
      toAdd.push({ date, time, capacity: cap });
    };

    if ('slots' in body && Array.isArray(body.slots)) {
      for (const s of body.slots) pushOne(s?.date, s?.time, s?.capacity);
    } else if ('times' in body && Array.isArray((body as InMany).times)) {
      const b = body as InMany;
      for (const t of (b.times ?? [])) pushOne(b.date, t, b.capacity);
    } else {
      const b = body as InOne;
      pushOne(b.date, b.time, b.capacity);
    }

    if (!toAdd.length) {
      return NextResponse.json(
        { error: 'Chýba date/time alebo times/slots.' },
        { status: 400, headers: noCache }
      );
    }

    for (const s of toAdd) {
      const idx = data.slots.findIndex(x => byDateTime(x, s.date, s.time));
      const base: Slot = {
        id: makeId(s.date, s.time),
        date: s.date,
        time: s.time,
        locked: false,
        booked: false,
        capacity: s.capacity ?? 1,
        bookedCount: 0,
      };
      if (idx >= 0) {
        // update existujúceho (napr. zmena capacity)
        data.slots[idx] = { ...base, ...data.slots[idx], capacity: s.capacity ?? data.slots[idx].capacity ?? 1 };
      } else {
        data.slots.push(base);
      }
    }

    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);

    return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/* ====================================================================== */
/* PATCH: úpravy                                                           */
/* Podporované payloady:                                                   */
/* - lock/unlock celého dňa:   { action:'lockDay'|'unlockDay', date }      */
/* - lock/unlock jedného slotu:{ action:'lock'|'unlock', id? | (date,time)}*/
/* - delete jedného slotu:     { action:'delete', id? | (date,time)}       */
/* - zmena kapacity slotu:     { action:'capacity', capacity, id? | (date,time)} */
/* ====================================================================== */
export async function PATCH(req: Request) {
  try {
    const payload = await req.json() as {
      action?: 'lockDay' | 'unlockDay' | 'lock' | 'unlock' | 'delete' | 'capacity';
      date?: string;
      time?: string;
      id?: string;
      capacity?: number;
    };

    if (!payload?.action) {
      return NextResponse.json({ error: 'Chýba action.' }, { status: 400, headers: noCache });
    }

    const data = await readJson<SlotsPayload>(KEY, DEFAULT);

    /* ---- lock/unlock celého dňa ---- */
    if (payload.action === 'lockDay' || payload.action === 'unlockDay') {
      if (!payload.date) {
        return NextResponse.json({ error: 'Chýba date.' }, { status: 400, headers: noCache });
      }
      const lock = payload.action === 'lockDay';
      for (const s of data.slots) if (s.date === payload.date) s.locked = lock;
      data.updatedAt = new Date().toISOString();
      await writeJson(KEY, data);
      return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
    }

    /* ---- operácie na jednom slote (podľa id alebo date+time) ---- */
    const findIndex = () => {
      if (payload.id) return data.slots.findIndex(s => s.id === payload.id);
      if (payload.date && payload.time) return data.slots.findIndex(s => byDateTime(s, payload.date!, payload.time!));
      return -1;
    };
    const idx = findIndex();
    if (idx < 0) {
      return NextResponse.json({ error: 'Slot neexistuje (id alebo date/time).' }, { status: 404, headers: noCache });
    }

    if (payload.action === 'delete') {
      data.slots.splice(idx, 1);
    } else if (payload.action === 'lock' || payload.action === 'unlock') {
      data.slots[idx].locked = payload.action === 'lock';
    } else if (payload.action === 'capacity') {
      const cap = Number.isFinite(+payload.capacity!) ? Math.max(1, +payload.capacity!) : 1;
      data.slots[idx].capacity = cap;
      // voliteľne uprav booked/bookedCount, aby nepresahoval capacity
      if ((data.slots[idx].bookedCount ?? 0) > cap) data.slots[idx].bookedCount = cap;
      if (data.slots[idx].booked && cap > 1) {
        // starý „boolean booked“ si necháme, ale preferujeme bookedCount
        data.slots[idx].booked = (data.slots[idx].bookedCount ?? 0) >= cap;
      }
    }

    data.updatedAt = new Date().toISOString();
    await writeJson(KEY, data);

    return NextResponse.json({ ok: true, slots: data.slots }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'PATCH /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/* ====================================================================== */
/* DELETE: úplné vymazanie všetkých slotov                                 */
/* ====================================================================== */
export async function DELETE() {
  try {
    const empty: SlotsPayload = { slots: [], updatedAt: new Date().toISOString() };
    await writeJson(KEY, empty);
    return NextResponse.json({ ok: true, slots: [] }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'DELETE /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}
