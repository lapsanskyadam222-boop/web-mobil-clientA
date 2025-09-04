// app/api/reservations/route.ts
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { buildICS } from '@/lib/ics';
import { sendReservationEmail } from '@/lib/sendEmail';

type Body = {
  slotId?: string;
  name?: string;
  email?: string;
  phone?: string;
};

function bad(msg: string, status = 400) {
  return new NextResponse(JSON.stringify({ error: msg }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function ok(payload: unknown, status = 200) {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    // ── 1) základna validácia
    const slotId = body.slotId?.trim();
    const name   = body.name?.trim();
    const email  = body.email?.trim();
    const phone  = body.phone?.trim();

    if (!slotId || !name || !email || !phone) {
      return bad('Chýba slotId, meno, e-mail alebo telefón.');
    }
    // veľmi jemné kontroly (nechceme zbytočne odmietať)
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return bad('Zadaj platný e-mail.');
    }
    if (phone.length < 6) {
      return bad('Zadaj platné telefónne číslo.');
    }

    // ── 2) volanie atomickej DB funkcie
    const supa = getServiceClient();
    const { data, error } = await supa.rpc('book_slot', {
      p_slot_id: slotId,
      p_name: name,
      p_email: email,
      p_phone: phone,
    });

    if (error) {
      const msg = String(error.message || '');

      // presné mapovanie na 409 (konflikt / obsadené)
      if (msg.includes('SLOT_NOT_AVAILABLE') || msg.includes('slot is locked') || msg.includes('capacity reached')) {
        return bad('Tento termín je už obsadený. Prosím vyber si iný.', 409);
      }

      console.error('book_slot error:', error);
      return bad('Rezervácia zlyhala. Skús to, prosím, o chvíľu znova.', 500);
    }

    // Supabase RPC pri RETURNS TABLE vracia pole
    const resv = Array.isArray(data) ? data[0] : data;
    // očakávané polia: { id, slot_id, date, time, name, email, phone, created_at }

    // ── 3) ICS (60 min) – nechaj tak, ak máš buildICS pripravený
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

    // ── 4) e-mail adminovi (ak máš nastavený RESEND)
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

    return ok({ ok: true, reservation: resv }, 201);
  } catch (e: any) {
    console.error('POST /api/reservations failed:', e);
    return bad(e?.message ?? 'Neznáma chyba', 500);
  }
}
