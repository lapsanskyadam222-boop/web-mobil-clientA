import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// GET /api/slots[?public=1]
export async function GET(req: Request) {
  try {
    const supa = getServiceClient();
    const url = new URL(req.url);
    const isPublic = url.searchParams.get('public') === '1';

    if (isPublic) {
      // iba voľné sloty (view)
      const { data, error } = await supa
        .from('slots_available')
        .select('id,date,time,locked,capacity,booked_count')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        slots: (data ?? []).map(r => ({
          id: r.id,
          date: r.date as unknown as string,
          time: r.time as unknown as string,
          locked: Boolean(r.locked),
          capacity: Number(r.capacity ?? 1),
          bookedCount: Number(r.booked_count ?? 0),
        })),
      });
    }

    // ADMIN – všetky sloty
    const { data, error } = await supa
      .from('slots')
      .select('id,date,time,locked,capacity,booked_count')
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      slots: (data ?? []).map(r => ({
        id: r.id,
        date: r.date as unknown as string,
        time: r.time as unknown as string,
        locked: Boolean(r.locked),
        capacity: Number(r.capacity ?? 1),
        bookedCount: Number(r.booked_count ?? 0),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}

// POST /api/slots  body: {date: 'YYYY-MM-DD', time: 'HH:MM', capacity?: number}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const date = String(body?.date ?? '');
    const time = String(body?.time ?? '');
    const capacity = Math.max(1, Number.isFinite(+body?.capacity) ? +body.capacity : 1);

    if (!date || !time) {
      return NextResponse.json({ error: 'Chýba date alebo time' }, { status: 400 });
    }

    const id = `${date}_${time.replace(':', '')}`;
    const supa = getServiceClient();

    // upsert – ak existuje, nič nemeníme; ak nie, vytvoríme
    const { error } = await supa
      .from('slots')
      .upsert(
        { id, date, time, capacity, locked: false },
        { onConflict: 'id' }
      );

    if (error) throw error;

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}

// PATCH /api/slots  body: { id, action: 'lock'|'unlock'|'capacity'|'delete', capacity? }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? '');
    const action = String(body?.action ?? '');

    if (!id || !action) {
      return NextResponse.json({ error: 'Chýba id alebo action' }, { status: 400 });
    }

    const supa = getServiceClient();

    if (action === 'lock') {
      const { error } = await supa.from('slots').update({ locked: true }).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'unlock') {
      const { error } = await supa.from('slots').update({ locked: false }).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'capacity') {
      const capacity = Math.max(1, Number.isFinite(+body?.capacity) ? +body.capacity : 1);
      const { error } = await supa.from('slots').update({ capacity }).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      const { error } = await supa.from('slots').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Neznáma akcia' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
