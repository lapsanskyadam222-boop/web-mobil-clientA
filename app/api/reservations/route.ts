// app/api/reservations/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { buildICS } from '@/lib/ics';
import { sendReservationEmail } from '@/lib/sendEmail';

export async function POST(req: Request) {
  try {
    const { slotId, name, email, phone } = await req.json();

    if (!slotId || !name || !email || !phone) {
      return NextResponse.json({ error: 'Chýba slotId, meno, e-mail alebo telefón.' }, { status: 400 });
    }

    const supa = getServiceClient();

    // 1) Skús „rezervovať“ – zvýšiť booked_count iba ak je voľné a nie je locked
    const { data: updated, error: upErr } = await supa
      .from('slots')
      .update({ booked_count: supa.rpc('noop') as unknown as number }) // placeholder, hneď nižšie real update
      .eq('id', slotId)
      .select();

    // Poznámka: Supabase JS nevie transakcie; spravíme to v dvoch krokoch s guardom
    // Najprv over aktuálny slot:
    const { data: slotArr, error: readErr } = await supa.from('slots')
      .select('*')
      .eq('id', slotId)
      .limit(1);

    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
    const slot = slotArr?.[0];
    if (!slot) return NextResponse.json({ error: 'Slot neexistuje.' }, { status: 404 });
    if (slot.locked) return NextResponse.json({ error: 'Slot je zamknutý.' }, { status: 409 });
    if (slot.booked_count >= slot.capacity) {
      return NextResponse.json({ error: 'Slot je plný.' }, { status: 409 });
    }

    // „Optimistic guard“: zvýš booked_count ak ešte nie je plno
    const { data: after, error: incErr } = await supa.rpc('increment_booked_count_if_free', { p_id: slotId });
    if (incErr) return NextResponse.json({ error: incErr.message }, { status: 500 });
    if (!after || after.length === 0) {
      // niekto nás predbehol
      return NextResponse.json({ error: 'Slot je už plný alebo zamknutý.' }, { status: 409 });
    }

    // 2) Zapíš rezerváciu
    const { data: resv, error: insErr } = await supa
      .from('reservations')
      .insert({ slot_id: slotId, name: name.trim(), email: email.trim(), phone: phone.trim() })
      .select()
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // 3) Email + ICS (dobrovoľné – ponechávam tvoju existujúcu logiku)
    const startLocal = new Date(`${slot.date}T${slot.time}:00`);
    const ics = buildICS({
      title: `Rezervácia: ${name} (${phone})`,
      start: startLocal,
      durationMinutes: 60,
      location: 'Lezenie s Nicol',
      description:
        `Rezervácia cez web.\nMeno: ${name}\nE-mail: ${email}\nTelefón: ${phone}\nTermín: ${slot.date} ${slot.time}`,
    });
    await sendReservationEmail?.(
      `Nová rezervácia ${slot.date} ${slot.time} — ${name}`,
      `<p><strong>Nová rezervácia</strong></p>
       <ul>
         <li><b>Termín:</b> ${slot.date} ${slot.time}</li>
         <li><b>Meno:</b> ${name}</li>
         <li><b>E-mail:</b> ${email}</li>
         <li><b>Telefón:</b> ${phone}</li>
       </ul>`,
      { filename: 'rezervacia.ics', content: ics }
    );

    return NextResponse.json({ ok: true, reservation: resv }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
