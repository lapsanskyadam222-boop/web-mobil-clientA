"use client";

import { useMemo, useState } from "react";

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };

const WD = ["po","ut","st","št","pia","so","ne"];
const monthLabel = (d: Date) =>
  d.toLocaleDateString("sk-SK", { month: "long", year: "numeric" });

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toISO(d: Date)  { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function buildCalendar(year: number, month0: number) {
  const first = new Date(year, month0, 1);
  const last  = new Date(year, month0 + 1, 0);

  const start = new Date(first);
  const day = start.getDay(); // 0=ne
  const diff = (day === 0 ? -6 : 1 - day); // zarovnanie na pondelok
  start.setDate(start.getDate() + diff);
  start.setHours(0,0,0,0);

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i=0;i<42;i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d, inMonth: d >= first && d <= last });
  }
  return cells;
}

function fmtLong(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("sk-SK", { day:"numeric", month:"numeric", year:"numeric" });
}

export default function ClientRezervacia({ slots }: { slots: Slot[] }) {
  const todayIso = new Date().toISOString().slice(0,10);

  const available = useMemo(
    () => (slots ?? [])
      .filter(s => s.date >= todayIso && !s.locked && !s.booked)
      .sort((a,b)=> (a.date===b.date ? (a.time<b.time?-1:1) : (a.date<b.date?-1:1))),
    [slots, todayIso]
  );

  if (!available.length) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="mb-4 text-2xl font-bold text-center">Rezervácia</h1>
        <p className="text-sm opacity-70 text-center">Momentálne nie sú dostupné žiadne termíny. Skúste neskôr.</p>
      </main>
    );
  }

  const firstDate = available[0].date;
  const [anchor, setAnchor] = useState(() => { const d = new Date(firstDate); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [activeDate, setActiveDate] = useState(firstDate);

  const cells = useMemo(() => buildCalendar(anchor.getFullYear(), anchor.getMonth()), [anchor]);

  const availableDates = useMemo(() => new Set(available.map(s => s.date)), [available]);
  const daySlots = useMemo(() => available.filter(s => s.date === activeDate), [available, activeDate]);

  function prevMonth() { const d = new Date(anchor); d.setMonth(d.getMonth()-1); setAnchor(d); }
  function nextMonth() { const d = new Date(anchor); d.setMonth(d.getMonth()+1); setAnchor(d); }

  const grid7: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 };
  const cellH = 56;

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-2xl font-bold">Rezervácia</h1>

      <div className="w-full">
        {/* Hlavička mesiaca */}
        <div className="mb-3 flex items-center justify-between">
          <button onClick={prevMonth} className="rounded border px-3 py-1 hover:bg-gray-50" aria-label="Predchádzajúci mesiac">‹</button>
          <div className="text-base font-semibold capitalize">{monthLabel(anchor)}</div>
          <button onClick={nextMonth} className="rounded border px-3 py-1 hover:bg-gray-50" aria-label="Nasledujúci mesiac">›</button>
        </div>

        {/* Názvy dní */}
        <div style={grid7} className="text-center text-xs mb-1">
          {WD.map(w => (
            <div key={w} className="py-2 font-semibold opacity-70 uppercase">{w}</div>
          ))}
        </div>

        {/* Mriežka 7×6 */}
        <div style={grid7} className="mb-8">
          {cells.map(({ date, inMonth }, idx) => {
            const iso = toISO(date);
            const isAv   = availableDates.has(iso);
            const isPast = iso < todayIso;
            const isAct  = iso === activeDate;

            const common = "rounded border flex items-center justify-center select-none";
            const style: React.CSSProperties = { height: cellH };

            let cls = "";
            if (!inMonth) cls = "bg-gray-50 text-gray-300";
            else if (isAct) cls = "bg-black text-white border-black";
            else if (isAv && !isPast) cls = "bg-white hover:bg-gray-100 cursor-pointer";
            else cls = "bg-gray-100 text-gray-400";

            return (
              <button
                type="button"
                key={idx}
                disabled={!inMonth || !isAv || isPast}
                onClick={()=> setActiveDate(iso)}
                title={fmtLong(iso)}
                className={`${common} ${cls}`}
                style={style}
              >
                <span className="text-sm">{date.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ReservationForm date={activeDate} daySlots={daySlots} />
    </main>
  );
}

function ReservationForm({ date, daySlots }: { date: string; daySlots: Slot[] }) {
  const [slotId, setSlotId] = useState<string>(daySlots[0]?.id ?? "");
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  if (daySlots.length && !daySlots.find(s => s.id === slotId)) {
    setSlotId(daySlots[0].id);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slotId)       return alert("Vyber čas.");
    if (!name.trim())  return alert("Zadaj meno.");
    if (!email.trim()) return alert("Zadaj e-mail.");
    if (!phone.trim()) return alert("Zadaj telefón.");

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Odoslanie zlyhalo");
      window.location.href = "/rezervacia/ok";
    } catch (err: any) {
      alert(err?.message || "Odoslanie zlyhalo");
    }
  }

  function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("sk-SK",{day:"numeric",month:"numeric",year:"numeric"});
  }

  return (
    <form onSubmit={submit} className="w-full rounded border p-3 space-y-3">
      <div className="text-xs opacity-70">Dátum: <strong>{fmt(date)}</strong></div>

      <label className="block">
        <span className="block text-xs mb-1">Čas</span>
        <select value={slotId} onChange={(e)=> setSlotId(e.target.value)} className="w-full border rounded px-3 py-2">
          {daySlots.length ? daySlots.map(s => (
            <option key={s.id} value={s.id}>{s.time}</option>
          )) : <option value="" disabled>Žiadne časy v tento deň</option>}
        </select>
      </label>

      <label className="block">
        <span className="block text-xs mb-1">Meno</span>
        <input className="w-full border rounded px-3 py-2" value={name} onChange={e=>setName(e.target.value)} />
      </label>

      <label className="block">
        <span className="block text-xs mb-1">E-mail</span>
        <input type="email" className="w-full border rounded px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} />
      </label>

      <label className="block">
        <span className="block text-xs mb-1">Telefón</span>
        <input className="w-full border rounded px-3 py-2" value={phone} onChange={e=>setPhone(e.target.value)} />
      </label>

      <button type="submit" className="w-full rounded bg-black text-white py-2 hover:bg-gray-800" disabled={!daySlots.length}>
        Vybrať si termín
      </button>

      <p className="text-xs opacity-70">* Klikateľné sú len dni, ktoré majú voľné termíny.</p>
    </form>
  );
}
