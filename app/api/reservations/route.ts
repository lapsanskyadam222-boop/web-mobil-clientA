// app/api/reservations/route.ts
import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';
import { buildICS } from '@/lib/ics';
import { sendReservationEmail } from '@/lib/sendEmail';

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean; };
type SlotsPayload = { slots: Slot[]; updatedAt: string };
type Reservation = { id: string; slotId: string; date: string; time: string; name: string; phone: string; createdAt: string; };
type ReservationsPayload = { reservations: Reservation[]; updatedAt: string };

const SLOTS_KEY = 'slots.json';
const RES_KEY = 'reservations.json';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slotId, name, phone } = body as { slotId?: string; name?: string; phone?: string };

    if (!slotId || !name || !phone) {
      return NextResponse.json({ error: 'Chýba slotId, meno alebo telefón.' }, { status: 400 });
    }

    const slotsPayload = await readJson<SlotsPayload>(SLOTS_KEY, { slots: [], updatedAt: '' });
    const resPayload = await readJson<ReservationsPayload>(RES_KEY, { reservations: [], updatedAt: '' });

    const slot = slotsPayload.slots.find(s => s.id === slotId);
    if (!slot) return NextResponse.json({ error: 'Slot neexistuje.' }, { status: 404 });
    if (slot.locked) return NextResponse.json({ error: 'Slot je zamknutý.' }, { status: 409 });
    if (slot.booked) return NextResponse.json({ error: 'Slot je už rezervovaný.' }, { status: 409 });

    slot.booked = true;
    slotsPayload.updatedAt = new Date().toISOString();

    const reservation: Reservation = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      slotId: slot.id,
      date: slot.date,
      time: slot.time,
      name,
      phone,
      createdAt: new Date().toISOString(),
    };
    resPayload.reservations.push(reservation);
    resPayload.updatedAt = new Date().toISOString();

    await writeJson(SLOTS_KEY, slotsPayload);
    await writeJson(RES_KEY, resPayload);

    // Email + ICS (ak máš RESEND kľúč a FROM/NOTIFY env)
    const startLocal = new Date(`${slot.date}T${slot.time}:00`);
    const ics = buildICS({
      title: `Rezervácia: ${name} (${phone})`,
      start: startLocal,
      durationMinutes: 60,
      location: 'Lezenie s Nicol',
      description: `Rezervácia cez web.\nMeno: ${name}\nTelefón: ${phone}\nTermín: ${slot.date} ${slot.time}`,
    });
    await sendReservationEmail?.(
      `Nová rezervácia ${slot.date} ${slot.time} — ${name}`,
      `<p>Nová rezervácia:</p>
       <ul>
         <li><b>Termín:</b> ${slot.date} ${slot.time}</li>
         <li><b>Meno:</b> ${name}</li>
         <li><b>Telefón:</b> ${phone}</li>
       </ul>`,
      { filename: 'rezervacia.ics', content: ics }
    );

    return NextResponse.json({ ok: true, reservation }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
