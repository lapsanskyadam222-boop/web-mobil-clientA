import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { buildICS } from '@/lib/ics';
import { sendReservationEmail } from '@/lib/sendEmail';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slotId, name, email, phone } = body as {
      slotId?: string; name?: string; email?: string; phone?: string;
    };

    if (!slotId || !name || !email || !phone) {
      return NextResponse.json(
        { error: 'Chýba slotId, meno, e-mail alebo telefón.' },
        { status: 400 }
      );
    }

    const supa = getServiceClient();

    // 🔴 Zavoláme atómovú DB funkciu
    const { data, error } = await supa.rpc('book_slot', {
      p_slot_id: slotId,
      p_name: name.trim(),
      p_email: email.trim(),
      p_phone: phone.trim(),
    });

    if (error) {
      // ak funkcia vyhodila našu hlášku, pošleme 409
      if (String(error.message || '').includes('SLOT_NOT_AVAILABLE')) {
        return NextResponse.json({ error: 'Tento termín už nie je dostupný.' }, { status: 409 });
      }
      console.error('book_slot error:', error);
      return NextResponse.json({ error: 'Rezervácia zlyhala.' }, { status: 500 });
    }

    // data je pole (návrat z RETURNS TABLE) – zober prvý riadok
    const resv = Array.isArray(data) ? data[0] : data;
    // resv obsahuje: id, slot_id, date, time, name, email, phone, created_at

    // ICS pozvánka (1h)
    const startLocal = new Date(`${resv.date}T${resv.time}:00`);
    const ics = buildICS({
      title: `Rezervácia: ${resv.name} (${resv.phone})`,
      start: startLocal,
      durationMinutes: 60,
      location: 'Lezenie s Nicol',
      description:
        `Rezervácia cez web.\n` +
        `Meno: ${resv.name}\n` +
        `E-mail: ${resv.email}\n` +
        `Telefón: ${resv.phone}\n` +
        `Termín: ${resv.date} ${resv.time}`,
    });

    // Admin e-mail (nechávam voliteľné – ak je správne nastavený RESEND)
    await sendReservationEmail?.(
      `Nová rezervácia ${resv.date} ${resv.time} — ${resv.name}`,
      `<p><strong>Nová rezervácia</strong></p>
       <ul>
         <li><b>Termín:</b> ${resv.date} ${resv.time}</li>
         <li><b>Meno:</b> ${resv.name}</li>
         <li><b>E-mail:</b> ${resv.email}</li>
         <li><b>Telefón:</b> ${resv.phone}</li>
       </ul>`,
      { filename: 'rezervacia.ics', content: ics }
    );

    return NextResponse.json({ ok: true, reservation: resv }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
