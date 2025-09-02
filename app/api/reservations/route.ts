import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';
import { buildICS } from '@/lib/ics';
import { sendReservationEmail } from '@/lib/sendEmail';

type Slot = {
  id: string;
  date: string;
  time: string;
  locked?: boolean;
  booked?: boolean;   // legacy
  capacity?: number;  // default 1
  bookedCount?: number; // default 0
};
type SlotsPayload = { slots: Slot[]; updatedAt: string };

type Reservation = {
  id: string;
  slotId: string;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
};
type ReservationsPayload = { reservations: Reservation[]; updatedAt: string };

const SLOTS_KEY = 'slots.json';
const RES_KEY   = 'reservations.json';

function withDefaults(s: Slot): Slot {
  const capacity = s.capacity ?? 1;
  const bookedCount = s.bookedCount ?? (s.booked ? 1 : 0);
  return { ...s, capacity, bookedCount, booked: bookedCount >= capacity };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slotId, name, email, phone } = body as {
      slotId?: string; name?: string; email?: string; phone?: string;
    };
    if (!slotId || !name || !email || !phone) {
      return NextResponse.json({ error: 'Chýba slotId, meno, e-mail alebo telefón.' }, { status: 400 });
    }

    const slotsPayload = await readJson<SlotsPayload>(SLOTS_KEY, { slots: [], updatedAt: '' });
    slotsPayload.slots = (slotsPayload.slots ?? []).map(withDefaults);
    const resPayload   = await readJson<ReservationsPayload>(RES_KEY, { reservations: [], updatedAt: '' });

    const slot = slotsPayload.slots.find(s => s.id === slotId);
    if (!slot)       return NextResponse.json({ error: 'Slot neexistuje.' }, { status: 404 });
    if (slot.locked) return NextResponse.json({ error: 'Slot je zamknutý.' }, { status: 409 });

    const capacity = slot.capacity ?? 1;
    const bookedCount = slot.bookedCount ?? 0;
    if (bookedCount >= capacity) {
      return NextResponse.json({ error: 'Slot je už plne obsadený.' }, { status: 409 });
    }

    // zapíš rezerváciu + navýš bookedCount
    slot.bookedCount = bookedCount + 1;
    slot.booked = slot.bookedCount >= capacity;

    slotsPayload.updatedAt = new Date().toISOString();

    const reservation: Reservation = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      slotId: slot.id,
      date: slot.date,
      time: slot.time,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      createdAt: new Date().toISOString(),
    };
    resPayload.reservations.push(reservation);
    resPayload.updatedAt = new Date().toISOString();

    await writeJson(SLOTS_KEY, slotsPayload);
    await writeJson(RES_KEY, resPayload);

    // ICS (1h)
    const startLocal = new Date(`${slot.date}T${slot.time}:00`);
    const ics = buildICS({
      title: `Rezervácia: ${reservation.name} (${reservation.phone})`,
      start: startLocal,
      durationMinutes: 60,
      location: 'Lezenie s Nicol',
      description:
        `Rezervácia cez web.\n` +
        `Meno: ${reservation.name}\n` +
        `E-mail: ${reservation.email}\n` +
        `Telefón: ${reservation.phone}\n` +
        `Termín: ${reservation.date} ${reservation.time}`,
    });

    await sendReservationEmail?.(
      `Nová rezervácia ${reservation.date} ${reservation.time} — ${reservation.name}`,
      `<p><strong>Nová rezervácia</strong></p>
       <ul>
         <li><b>Termín:</b> ${reservation.date} ${reservation.time}</li>
         <li><b>Meno:</b> ${reservation.name}</li>
         <li><b>E-mail:</b> ${reservation.email}</li>
         <li><b>Telefón:</b> ${reservation.phone}</li>
       </ul>`,
      { filename: 'rezervacia.ics', content: ics }
    );

    return NextResponse.json({ ok: true, reservation }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
