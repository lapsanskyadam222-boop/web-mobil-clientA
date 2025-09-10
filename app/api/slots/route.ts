// app/api/slots/route.ts
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

type SlotRow = {
  id: string;
  date: string;     // ISO date z Postgres DATE
  time: string;     // hm (text "HH:MM")
  locked: boolean;
  capacity: number;
  booked_count: number;
};

export async function GET(req: Request) {
  try {
    const supa = getServiceClient();
    const url = new URL(req.url);
    const isPublic = url.searchParams.get('public') === '1';

    if (isPublic) {
      // Verejné - len dostupné
      const { data, error } = await supa
        .from('slots_available') // view
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) {
        console.error('GET /slots public error:', error);
        return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
      }

      return NextResponse.json({ slots: (data ?? []) as SlotRow[] });
    }

    // Admin - všetky sloty
    const { data, error } = await supa
      .from('slots')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) {
      console.error('GET /slots error:', error);
      return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
    }

    return NextResponse.json({ slots: (data ?? []) as SlotRow[] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supa = getServiceClient();
    const body = await req.json().catch(() => ({}));
    const { date, time, capacity } = body as {
      date?: string;
      time?: string;
      capacity?: number;
    };

    if (!date || !time) {
      return NextResponse.json({ error: 'Missing date or time' }, { status: 400 });
    }

    const cap = Math.max(1, Number(capacity) || 1);
    const id = `${date}_${time.replace(':', '')}`;

    const { error } = await supa.from('slots').insert({
      id,
      date,
      time,              // hm text "HH:MM"
      capacity: cap,
      locked: false,
      booked_count: 0,
    });

    if (error) {
      // ignoruj conflict (unique date+time), inak vráť chybu
      if (error.code !== '23505') {
        console.error('POST /slots error:', error);
        return NextResponse.json({ error: 'Failed to create slot' }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supa = getServiceClient();
    const body = await req.json().catch(() => ({}));
    const { id, action, capacity } = body as {
      id?: string;
      action?: 'lock' | 'unlock' | 'delete' | 'capacity' | 'free';
      capacity?: number;
    };

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
    }

    if (action === 'free') {
      // Reset: zmaž rezervácie, booked_count=0, locked=false
      const { data, error } = await supa.rpc('admin_free_slot', { p_slot_id: id });
      if (error) {
        console.error('admin_free_slot error:', error);
        return NextResponse.json({ error: 'Free slot failed' }, { status: 500 });
      }
      const slot = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ ok: true, slot });
    }

    if (action === 'lock') {
      const { error } = await supa.from<SlotRow>('slots').update({ locked: true }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'unlock') {
      const { error } = await supa.from<SlotRow>('slots').update({ locked: false }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'capacity') {
      const cap = Math.max(1, Number(capacity) || 1);
      const { error } = await supa.from<SlotRow>('slots').update({ capacity: cap }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      // najprv rezervácie (pre istotu; FK ON DELETE CASCADE by to spravil tiež)
      const { error: er1 } = await supa.from('reservations').delete().eq('slot_id', id);
      if (er1) return NextResponse.json({ error: er1.message }, { status: 500 });

      const { error: er2 } = await supa.from('slots').delete().eq('id', id);
      if (er2) return NextResponse.json({ error: er2.message }, { status: 500 });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
