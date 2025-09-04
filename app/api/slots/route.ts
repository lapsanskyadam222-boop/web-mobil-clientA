import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

type Row = {
  id: string;
  date: string;  // 'YYYY-MM-DD'
  time: string;  // 'HH:MM'
  locked: boolean;
  capacity: number;
  booked_count: number; // z tabuľky slots
};

function mapRow(r: Row) {
  const booked = Number(r.booked_count ?? 0) >= Number(r.capacity ?? 1);
  return {
    id: r.id,
    date: r.date,
    time: r.time,
    locked: !!r.locked,
    capacity: Number(r.capacity ?? 1),
    bookedCount: Number(r.booked_count ?? 0),
    booked,
  };
}

// GET /api/slots[?public=1]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const isPublic = searchParams.get('public') === '1';

  const supa = getServiceClient();

  // verejnosti servuj iba voľné sloty z view; adminovi všetky sloty
  const from = isPublic ? 'slots_available' : 'slots';
  const { data, error } = await supa
    .from(from)
    .select('id,date,time,locked,capacity,booked_count')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) {
    console.error('GET /api/slots error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    slots: (data as Row[]).map(mapRow),
  });
}

// POST /api/slots { date, time, capacity }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const date = String(body?.date ?? '');
    const time = String(body?.time ?? '');
    const capacity = Math.max(1, Number(body?.capacity ?? 1));

    if (!date || !time) {
      return NextResponse.json({ error: 'Chýba date/time' }, { status: 400 });
    }

    const supa = getServiceClient();
    const { data, error } = await supa
      .from('slots')
      .upsert(
        { id: `${date}_${time.replace(':', '')}`, date, time, capacity, locked: false },
        { onConflict: 'id' },
      )
      .select('id,date,time,locked,capacity,booked_count')
      .single();

    if (error) throw error;

    return NextResponse.json({ slot: mapRow(data as Row) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Chyba pri zápise' }, { status: 500 });
  }
}

// PATCH /api/slots { id, action, ... }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? '');
    const action = String(body?.action ?? '');
    if (!id || !action) {
      return NextResponse.json({ error: 'Chýba id alebo action' }, { status: 400 });
    }

    const supa = getServiceClient();

    // ---------- UVOĽNIŤ (admin_free_slot) ----------
    if (action === 'free') {
      const { data, error } = await supa.rpc('admin_free_slot', { p_slot_id: id });
      if (error) throw error;
      // funkcia vracia riadok slotu; keď nie, dotiahni ručne
      if (Array.isArray(data) && data[0]) {
        const r = data[0] as Row;
        return NextResponse.json({ slot: mapRow(r) });
      }
      const fallback = await supa
        .from('slots')
        .select('id,date,time,locked,capacity,booked_count')
        .eq('id', id)
        .single();
      if (fallback.error) throw fallback.error;
      return NextResponse.json({ slot: mapRow(fallback.data as Row) });
    }

    // ---------- LOCK / UNLOCK ----------
    if (action === 'lock' || action === 'unlock') {
      const locked = action === 'lock';
      const { data, error } = await supa
        .from('slots')
        .update({ locked })
        .eq('id', id)
        .select('id,date,time,locked,capacity,booked_count')
        .single();
      if (error) throw error;
      return NextResponse.json({ slot: mapRow(data as Row) });
    }

    // ---------- ZMENA KAPACITY ----------
    if (action === 'capacity') {
      const capacity = Math.max(1, Number(body?.capacity ?? 1));
      const { data, error } = await supa
        .from('slots')
        .update({ capacity })
        .eq('id', id)
        .select('id,date,time,locked,capacity,booked_count')
        .single();
      if (error) throw error;
      return NextResponse.json({ slot: mapRow(data as Row) });
    }

    // ---------- VYMAZAŤ ----------
    if (action === 'delete') {
      // (FK na reservations je ON DELETE CASCADE)
      const { error } = await supa.from('slots').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Neznáma action "${action}"` }, { status: 400 });
  } catch (e: any) {
    console.error('PATCH /api/slots error:', e);
    return NextResponse.json({ error: e?.message ?? 'Chyba' }, { status: 500 });
  }
}
