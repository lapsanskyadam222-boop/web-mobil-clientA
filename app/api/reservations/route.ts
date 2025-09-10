// app/api/reservations/route.ts
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { buildICS } from '@/lib/ics';
import { sendReservationEmail } from '@/lib/sendEmail'; // alebo pôvodná cesta

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
    const { data, error } = await supa.rpc('book_slot', {
      p_slot_id: slotId,
      p_name: name.trim(),
      p_email: email.trim(),
      p_phone: phone.trim(),
    });

    if (error) {
      if (String(error.message || '').includes('SLOT_NOT_AVAILABLE')) {
        return NextResponse.json({ error: 'Tento termín už nie je dostupný.' }, { status: 409 });
      }
      console.error('book_slot error:', error);
      return NextResponse.json({ error: 'Rezervácia zlyhala.' }, { status: 500 });
    }

    // funkcia vracia riadok s názvami v_date, v_time:
    const resv = Array.isArray(data) ? data[0] : data;

    const dateStr = String(resv.v_date); // "YYYY-MM-DD"
    const timeStr = String(resv.v_time); // "HH:MM"

    // vytvoríme ICS na presný lokálny čas bez problémov s timezone
    const ics = buildICS({
      title: `Rezervácia: ${name} (${phone})`,
      date: dateStr,
      time: timeStr,
      durationMinutes: 60,
      timezone: 'Europe/Bratislava',
      location: 'Lezenie s Nicol',
      description:
        `Rezervácia cez web.\n` +
        `Meno: ${name}\n` +
        `E-mail: ${email}\n` +
        `Telefón: ${phone}\n` +
        `Termín: ${dateStr} ${timeStr}`,
    });

    // predmet a telo nech používajú správny dátum/čas
    await sendReservationEmail?.(
      `Nová rezervácia ${dateStr} ${timeStr} — ${name}`,
      `<p><strong>Nová rezervácia</strong></p>
       <ul>
         <li><b>Termín:</b> ${dateStr} ${timeStr}</li>
         <li><b>Meno:</b> ${name}</li>
         <li><b>E-mail:</b> ${email}</li>
         <li><b>Telefón:</b> ${phone}</li>
       </ul>`,
      { filename: 'rezervacia.ics', content: ics }
    );

    return NextResponse.json({ ok: true, reservation: { ...resv, date: dateStr, time: timeStr } }, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
