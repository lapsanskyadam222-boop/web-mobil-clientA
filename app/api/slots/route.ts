import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// Typ slotu, ktorý vraciame do UI
type SlotRow = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (hm doména v DB)
  locked: boolean;
  capacity: number;
  booked_count: number;
};

// GET /api/slots[?public=1]
// - public=1 => vracia len voľné (nezamknuté a neplné) sloty z view slots_available
// - inak vracia všetky sloty z tabuľky (pre admina)
export async function GET(req: Request) {
  const supa = getServiceClient();
  const url = new URL(req.url);
  const isPublic = url.searchParams.get('public') === '1';

  if (isPublic) {
    const q = await supa
      .from('slots_available')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (q.error) return NextResponse.json({ error: q.error.message }, { status: 500 });
    return NextResponse.json({ slots: q.data as SlotRow[] });
  }

  const q = await supa
    .from('slots')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });
  if (q.error) return NextResponse.json({ error: q.error.message }, { status: 500 });
  return NextResponse.json({ slots: q.data as SlotRow[] });
}

// POST /api/slots
// body: { date: 'YYYY-MM-DD', time: 'HH:MM', capacity?: number }
export async function POST(req: Request) {
  try {
    const { date, time, capacity } = (await req.json()) as {
      date?: string;
      time?: string;
      capacity?: number;
    };

    if (!date || !time) {
      return NextResponse.json({ error: 'Chýba date alebo time.' }, { status: 400 });
    }

    const cap = Math.max(1, Number.isFinite(+capacity!) ? +capacity! : 1);
    const supa = getServiceClient();

    const ins = await supa
      .from('slots')
      .insert({ id: `${date}_${time.replace(':', '')}`, date, time, capacity: cap })
      .select('*')
      .single();

    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
    return NextResponse.json({ slot: ins.data as SlotRow }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}

// PATCH /api/slots
// body: { id: string, action: 'lock'|'unlock'|'capacity'|'delete'|'free', capacity?: number }
export async function PATCH(req: Request) {
  try {
    const supa = getServiceClient();
    const { id, action, capacity } = (await req.json()) as {
      id?: string;
      action?: 'lock' | 'unlock' | 'capacity' | 'delete' | 'free';
      capacity?: number;
    };

    if (!id || !action) {
      return NextResponse.json({ error: 'Chýba id alebo action.' }, { status: 400 });
    }

    // zamknúť
    if (action === 'lock') {
      const up = await supa.from('slots').update({ locked: true }).eq('id', id);
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // odomknúť
    if (action === 'unlock') {
      const up = await supa.from('slots').update({ locked: false }).eq('id', id);
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // zmena kapacity
    if (action === 'capacity') {
      const cap = Math.max(1, Number.isFinite(+capacity!) ? +capacity! : 1);
      const up = await supa.from('slots').update({ capacity: cap }).eq('id', id);
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // vymazať slot (aj s rezerváciami kvôli FK ON DELETE CASCADE)
    if (action === 'delete') {
      const del = await supa.from('slots').delete().eq('id', id);
      if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // UVOĽNIŤ (to je ten dôležitý fix):
    // - zmaž všetky rezervácie daného slotu
    // - odomkni slot
    // - resetni booked_count = 0 (inak by book_slot hlásil „obsadené“)
    if (action === 'free') {
      // 1) zmaž rezervácie
      const del = await supa.from('reservations').delete().eq('slot_id', id);
      if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });

      // 2) odomknúť + vynulovať počítadlo
      const up = await supa
        .from('slots')
        .update({ locked: false, booked_count: 0 })
        .eq('id', id);
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Neznáma action.' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
