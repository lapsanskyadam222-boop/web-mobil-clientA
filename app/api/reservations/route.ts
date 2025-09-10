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

    // 1) atómová rezervácia v DB
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

    // 2) výsledok z funkcie (môže byť array)
    const resv = Array.isArray(data) ? data[0] : data;

    // Dátum/čas z DB sú podľa verzie: date/time alebo v_date/v_time
    const dateStr = String(resv?.date ?? resv?.v_date ?? '');
    const timeStr = String(resv?.time ?? resv?.v_time ?? '');

    // Bez dátumu/času nebudeme pokračovať
    if (!dateStr || !timeStr) {
      console.error('Missing date/time in reservation payload:', resv);
      return NextResponse.json({ error: 'Chýba dátum alebo čas rezervácie.' }, { status: 500 });
    }

    // 3) .ics – “floating” local time (bez Z/TZID), aby sa zobrazil presne
    //    ako ho zákazník vybral (bez posunu časových zón).
    const [Y, M, D] = dateStr.split('-').map((v: string) => parseInt(v, 10));
    const [h, m] = timeStr.split(':').map((v: string) => parseInt(v, 10));
    const ics = buildICS({
      title: `Rezervácia: ${name} (${phone})`,
      location: 'Lezenie s Nicol',
      description:
        `Rezervácia cez web.\n` +
        `Meno: ${name}\n` +
        `E-mail: ${email}\n` +
        `Telefón: ${phone}\n` +
        `Termín: ${dateStr} ${timeStr}`,
      startLocalParts: { year: Y, month: M, day: D, hour: h, minute: m },
      durationMinutes: 60, // môžeš upraviť
    });

    // 4) e-mail pre admina – predmet má reálny dátum a čas
    const subject = `Nová rezervácia ${dateStr} ${timeStr} — ${name}`;
    const html = `
      <p><strong>Nová rezervácia</strong></p>
      <ul>
        <li><b>Termín:</b> ${dateStr} ${timeStr}</li>
        <li><b>Meno:</b> ${name}</li>
        <li><b>E-mail:</b> ${email}</li>
        <li><b>Telefón:</b> ${phone}</li>
      </ul>`.trim();

    await sendReservationEmail?.(
      subject,
      html,
      { filename: 'rezervacia.ics', content: ics }
    );

    return NextResponse.json({
      ok: true,
      reservation: {
        id: resv.id,
        slot_id: resv.slot_id,
        date: dateStr,
        time: timeStr,
        name,
        email,
        phone,
        created_at: resv.created_at,
      }
    }, { status: 201 });

  } catch (e: any) {
    console.error('Reservations POST error:', e);
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
