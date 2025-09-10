import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET() {
  const supa = getServiceClient();
  const { data, error } = await supa
    .from('slots')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ slots: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, time, capacity } = body as {
      date?: string;
      time?: string;
      capacity?: number;
    };

    if (!date || !time) {
      return NextResponse.json({ error: 'Chýba dátum alebo čas.' }, { status: 400 });
    }

    const supa = getServiceClient();
    const id = `${date}_${time.replace(':', '')}`;
    const { error } = await supa.from('slots').upsert({
      id,
      date,
      time,
      capacity: capacity ?? 1,
      locked: false,
      booked_count: 0,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, action, capacity } = body as {
      id?: string;
      action?: 'lock' | 'unlock' | 'capacity' | 'delete' | 'free';
      capacity?: number;
    };

    if (!id || !action) {
      return NextResponse.json({ error: 'Chýba id alebo akcia.' }, { status: 400 });
    }

    const supa = getServiceClient();

    if (action === 'lock') {
      const { error } = await supa.from('slots').update({ locked: true }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'unlock') {
      const { error } = await supa.from('slots').update({ locked: false }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'capacity') {
      const cap = Math.max(1, Number(capacity) || 1);
      const { error } = await supa.from('slots').update({ capacity: cap }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      const { error } = await supa.from('slots').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'free') {
      // použijeme DB funkciu admin_free_slot -> tá vymaže rezervácie a resetne slot
      const { data, error } = await supa.rpc('admin_free_slot', { p_slot_id: id });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        slot: Array.isArray(data) ? data[0] : data, // vrátime nový stav slotu
      });
    }

    return NextResponse.json({ error: 'Neznáma akcia.' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
