// app/api/slots/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

type Slot = {
  id: string;           // "YYYY-MM-DD_HHMM"
  date: string;         // YYYY-MM-DD
  time: string;         // HH:MM (typ hm)
  locked: boolean;
  capacity: number;
  booked_count: number;
};

const noCache = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

const isIsoDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isHm      = (s?: string) => !!s && /^\d{2}:\d{2}$/.test(s);
const makeId    = (date: string, time: string) => `${date}_${time.replace(':','')}`;

/* GET – všetky sloty (pre admin), zoradené */
export async function GET() {
  const supa = getServiceClient();
  const { data, error } = await supa
    .from('slots')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noCache });
  return NextResponse.json({ slots: data ?? [] }, { headers: noCache });
}

/* POST – pridanie: 1 slot | {date, times[]} | {slots[]} */
export async function POST(req: Request) {
  try {
    const body = await req.json() as
      | { date?: string; time?: string; capacity?: number }
      | { date?: string; times?: string[]; capacity?: number }
      | { slots?: { date: string; time: string; capacity?: number }[] };

    const toAdd: { id: string; date: string; time: string; capacity: number }[] = [];

    if ('slots' in body && Array.isArray(body.slots)) {
      for (const s of body.slots) {
        if (isIsoDate(s?.date) && isHm(s?.time)) {
          const cap = Number.isFinite(+s.capacity!) ? Math.max(1, +s.capacity!) : 1;
          toAdd.push({ id: makeId(s.date, s.time), date: s.date, time: s.time, capacity: cap });
        }
      }
    } else if ('times' in body && isIsoDate(body.date) && Array.isArray(body.times)) {
      for (const t of body.times) {
        if (isHm(t)) {
          const cap = Number.isFinite(+body.capacity!) ? Math.max(1, +body.capacity!) : 1;
          toAdd.push({ id: makeId(body.date!, t), date: body.date!, time: t, capacity: cap });
        }
      }
    } else if ('date' in body && 'time' in body && isIsoDate(body.date) && isHm(body.time)) {
      const cap = Number.isFinite(+body.capacity!) ? Math.max(1, +body.capacity!) : 1;
      toAdd.push({ id: makeId(body.date!, body.time!), date: body.date!, time: body.time!, capacity: cap });
    }

    if (!toAdd.length) {
      return NextResponse.json({ error: 'Chýbajú platné sloty.' }, { status: 400, headers: noCache });
    }

    const supa = getServiceClient();

    // upsert podľa PK id; necháme defaulty na DB
    const { error } = await supa
      .from('slots')
      .upsert(
        toAdd.map(s => ({
          id: s.id,
          date: s.date,
          time: s.time,
          capacity: s.capacity,
          locked: false,
        })),
        { onConflict: 'id' }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noCache });

    // vrátime čerstvý zoznam
    const { data, error: e2 } = await supa
      .from('slots')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500, headers: noCache });
    return NextResponse.json({ ok: true, slots: data ?? [] }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'POST /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/* PATCH – {id, action: 'delete'|'lock'|'unlock'|'capacity', capacity?} */
export async function PATCH(req: Request) {
  try {
    const p = await req.json() as
      { id?: string; action: 'delete'|'lock'|'unlock'|'capacity'; capacity?: number } |
      { date: string; action: 'lockDay'|'unlockDay' };

    const supa = getServiceClient();

    if ('date' in p && (p.action === 'lockDay' || p.action === 'unlockDay')) {
      if (!isIsoDate(p.date)) return NextResponse.json({ error: 'Chýba platný date.' }, { status: 400, headers: noCache });
      const lock = p.action === 'lockDay';
      const { error } = await supa.from('slots').update({ locked: lock }).eq('date', p.date);
      if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noCache });
    } else if ('id' in p && p.id) {
      if (p.action === 'delete') {
        const { error } = await supa.from('slots').delete().eq('id', p.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noCache });
      } else if (p.action === 'lock' || p.action === 'unlock') {
        const { error } = await supa.from('slots').update({ locked: p.action === 'lock' }).eq('id', p.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noCache });
      } else if (p.action === 'capacity') {
        const cap = Math.max(1, Number.isFinite(+p.capacity!) ? +p.capacity! : 1);
        const { error } = await supa.from('slots').update({ capacity: cap }).eq('id', p.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noCache });
      }
    } else {
      return NextResponse.json({ error: 'Neplatná požiadavka.' }, { status: 400, headers: noCache });
    }

    const { data, error: e2 } = await supa
      .from('slots')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500, headers: noCache });
    return NextResponse.json({ ok: true, slots: data ?? [] }, { headers: noCache });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'PATCH /slots zlyhalo' }, { status: 500, headers: noCache });
  }
}

/* DELETE – vymazanie všetkých slotov */
export async function DELETE() {
  const supa = getServiceClient();
  const { error } = await supa.from('slots').delete().neq('id', ''); // vymaž všetko
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noCache });
  return NextResponse.json({ ok: true, slots: [] }, { headers: noCache });
}
