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
      action?: 'lock' | 'unlock' | 'capacity' | 'delete' | 'free' | 'restore';
      capacity?: number;
    };

    if (!id || !action) {
      return NextResponse.json({ error: 'Chýba id alebo akcia.' }, { status: 400 });
    }

    const supa = getServiceClient();

    // ZAMKNÚŤ
    if (action === 'lock') {
      const { error } = await supa.from('slots').update({ locked: true }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ODOMKNÚŤ
    if (action === 'unlock') {
      const { error } = await supa.from('slots').update({ locked: false }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // KAPACITA
    if (action === 'capacity') {
      const cap = Math.max(1, Number(capacity) || 1);
      const { error } = await supa.from('slots').update({ capacity: cap }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // VYMAZAŤ SLOT (zmaže aj rezervácie cez FK ON DELETE CASCADE)
    if (action === 'delete') {
      const { error } = await supa.from('slots').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // UVOĽNIŤ (FREE): DB funkcia vymaže rezervácie, locked=false, booked_count=0
    if (action === 'free') {
      const { error } = await supa.rpc('admin_free_slot', { p_slot_id: id });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // OBNOVIŤ (RESTORE): „tvrdý“ re-create — zmaž a znovu vlož ten istý slot
    if (action === 'restore') {
      // 1) načítaj parametre slotu
      const { data: slotData, error: readErr } = await supa
        .from('slots')
        .select('date, time, capacity')
        .eq('id', id)
        .single();
      if (readErr || !slotData) {
        return NextResponse.json({ error: 'Slot sa nenašiel' }, { status: 404 });
      }

      // 2) zmaž pôvodný
      const { error: delErr } = await supa.from('slots').delete().eq('id', id);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      // 3) vytvor nový s rovnakými hodnotami
      const newId = `${slotData.date}_${slotData.time.replace(':', '')}`;
      const { error: insErr } = await supa.from('slots').insert({
        id: newId,
        date: slotData.date,
        time: slotData.time,
        capacity: slotData.capacity,
        locked: false,
        booked_count: 0,
      });
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, id: newId });
    }

    return NextResponse.json({ error: 'Neznáma akcia.' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
