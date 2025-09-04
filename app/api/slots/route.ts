import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

type SlotRow = {
  id: string;
  date: string;
  time: string;
  locked: boolean;
  capacity: number;
  booked_count: number;
};

export async function GET(req: Request) {
  const supa = getServiceClient();
  const url = new URL(req.url);
  const isPublic = url.searchParams.get('public') === '1';

  if (isPublic) {
    // verejná časť – iba voľné sloty (view)
    const { data, error } = await supa
      .from('slots_available')
      .select('id,date,time,locked,capacity,booked_count')
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ slots: data ?? [] });
  }

  // admin – všetky sloty
  const { data, error } = await supa
    .from('slots')
    .select('id,date,time,locked,capacity,booked_count')
    .order('date', { ascending: true })
    .order('time', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slots: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const supa = getServiceClient();
    const body = await req.json();
    const { date, time, capacity = 1 } = body ?? {};
    if (!date || !time) return NextResponse.json({ error: 'date/time missing' }, { status: 400 });

    const id = `${date}_${String(time).replace(':', '')}`;
    const { error } = await supa.from('slots').upsert(
      [{ id, date, time, capacity, locked: false }],
      { onConflict: 'id' },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'POST error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supa = getServiceClient();
    const body = await req.json().catch(() => ({}));
    const { id, action, capacity } = body as {
      id?: string;
      action?: 'lock'|'unlock'|'capacity'|'delete'|'free'|'clearAll';
      capacity?: number;
    };

    if (action === 'lock' || action === 'unlock') {
      if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
      const { error } = await supa.from('slots').update({ locked: action === 'lock' }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'capacity') {
      if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
      const safe = Math.max(1, Number(capacity ?? 1));
      const { error } = await supa.from('slots').update({ capacity: safe }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
      // najprv zmaž rezervácie (trigger zníži counter), potom slot
      const delRes = await supa.from('reservations').delete().eq('slot_id', id);
      if (delRes.error) return NextResponse.json({ error: delRes.error.message }, { status: 500 });
      const delSlot = await supa.from('slots').delete().eq('id', id);
      if (delSlot.error) return NextResponse.json({ error: delSlot.error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'free') {
      // Admin uvoľní slot pre ďalšiu rezerváciu: vyčistíme rezervácie a odomkneme
      if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
      const del = await supa.from('reservations').delete().eq('slot_id', id);
      if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
      await supa.from('slots').update({ locked: false }).eq('id', id);
      return NextResponse.json({ ok: true });
    }

    if (action === 'clearAll') {
      // „Vymazať všetky“ – korektný JSON response
      const delRes = await supa.from('reservations').delete().neq('slot_id', '');
      if (delRes.error) return NextResponse.json({ error: delRes.error.message }, { status: 500 });
      const delSlots = await supa.from('slots').delete().neq('id', '');
      if (delSlots.error) return NextResponse.json({ error: delSlots.error.message }, { status: 500 });
      return NextResponse.json({ ok: true, cleared: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'PATCH error' }, { status: 500 });
  }
}
