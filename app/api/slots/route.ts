import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

/**
 * GET:
 * - /api/slots?public=1  -> vracia len odomknuté a voľné sloty (view slots_available)
 * - /api/slots           -> vracia všetky sloty (tabuľka slots) pre admina
 */
export async function GET(req: Request) {
  const supa = getServiceClient();
  const { searchParams } = new URL(req.url);
  const isPublic = searchParams.get('public') === '1';

  if (isPublic) {
    const { data, error } = await supa
      .from('slots_available') // VIEW
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ slots: data ?? [] });
  }

  // admin / interný prehľad – všetky sloty
  const { data, error } = await supa
    .from('slots') // TABUĽKA
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
      // zavolá DB funkciu, ktorá vymaže rezervácie a resetne počítadlo
      const { data, error } = await supa.rpc('admin_free_slot', { p_slot_id: id });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        slot: Array.isArray(data) ? data[0] : data, // vráti aktuálny stav slotu po resete
      });
    }

    return NextResponse.json({ error: 'Neznáma akcia.' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
