"use client";

import { useMemo, useState } from "react";

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
const wd = ["po","ut","st","št","pia","so","ne"];
const monthLabel = (d: Date) => d.toLocaleDateString("sk-SK", { month: "long", year: "numeric" });

function startOfWeekMon(d: Date) {
  const day = d.getDay(); // 0=ne
  const diff = (day === 0 ? -6 : 1 - day);
  const out = new Date(d);
  out.setDate(out.getDate() + diff);
  out.setHours(0,0,0,0);
  return out;
}
function buildMonthGrid(year: number, monthIdx0: number) {
  const first = new Date(year, monthIdx0, 1);
  const last  = new Date(year, monthIdx0 + 1, 0);
  const firstCell = startOfWeekMon(first);
  const weeks: (Date | null)[][] = [];
  let cur = new Date(firstCell);
  while (true) {
    const row: (Date | null)[] = [];
    for (let i=0;i<7;i++) {
      const cell = new Date(cur);
      row.push(cell < first || cell > last ? null : cell);
      cur.setDate(cur.getDate()+1);
    }
    weeks.push(row);
    if (weeks.length > 6 || (row[6] && row[6]! >= last)) break;
  }
  return weeks;
}
function formatDateSK(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("sk-SK", { day:"numeric", month:"numeric", year:"numeric" });
}

export default function ClientRezervacia({ slots }: { slots: Slot[] }) {
  const todayIso = new Date().toISOString().slice(0,10);

  const available = useMemo(
    () => (slots||[])
      .filter(s => s.date >= todayIso && !s.locked && !s.booked)
      .sort((a,b)=> (a.date===b.date ? (a.time<b.time?-1:1) : (a.date<b.date?-1:1))),
    [slots, todayIso]
  );

  if (!available.length) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Rezervácia</h1>
        <p className="text-sm opacity-70">Momentálne nie sú dostupné žiadne termíny. Skúste neskôr.</p>
      </main>
    );
  }

  const firstDate = available[0].date;
  const [monthAnchor, setMonthAnchor] = useState(() => { const d = new Date(firstDate); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [activeDate, setActiveDate] = useState(firstDate);

  const weeks = useMemo(() => buildMonthGrid(monthAnchor.getFullYear(), monthAnchor.getMonth()), [monthAnchor]);
  const availableDates = useMemo(() => new Set(available.map(s => s.date)), [available]);
  const daySlots = useMemo(() => available.filter(s => s.date === activeDate), [available, activeDate]);

  function prevMonth() { const d = new Date(monthAnchor); d.setMonth(d.getMonth()-1); setMonthAnchor(d); }
  function nextMonth() { const d = new Date(monthAnchor); d.setMonth(d.getMonth()+1); setMonthAnchor(d); }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Rezervácia</h1>

      <div className="mb-2 flex items-center justify-between">
        <button onClick={prevMonth} className="rounded border px-2 py-1 hover:bg-gray-50" aria-label="Predchádzajúci mesiac">‹</button>
        <div className="text-sm font-semibold">{monthLabel(monthAnchor)}</div>
        <button onClick={nextMonth} className="rounded border px-2 py-1 hover:bg-gray-50" aria-label="Nasledujúci mesiac">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
        {wd.map(w => <div key={w} className="py-1 font-medium opacity-70">{w}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-4">
        {weeks.flatMap((row,ri)=>
          row.map((cell,ci)=>{
            if (!cell) return <div key={`${ri}-${ci}`} className="aspect-square rounded border border-dashed opacity-30" />;
            const iso = toISO(cell);
            const isAv = availableDates.has(iso);
            const isActive = iso === activeDate;
            const isPast = iso < todayIso;
            const base = "aspect-square rounded border text-sm flex items-center justify-center";
            const state = isActive ? "bg-black text-white border-black"
              : isAv && !isPast ? "hover:bg-gray-100 cursor-pointer"
              : "opacity-40";
            return (
              <button
                type="button"
                key={iso}
                disabled={!isAv || isPast}
                onClick={()=> setActiveDate(iso)}
                className={`${base} ${state}`}
                title={formatDateSK(iso)}
              >
                <div className="leading-none"><div>{cell.getDate()}</div></div>
              </button>
            );
          })
        )}
      </div>

      <ReservationForm date={activeDate} daySlots={daySlots} />
    </main>
  );
}

function ReservationForm({ date, daySlots }: { date: string; daySlots: Slot[] }) {
  const [slotId, setSlotId] = useState<string>(daySlots[0]?.id ?? "");
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");   // povinné
  const [phone, setPhone] = useState("");

  // ak sa zmení deň, nastav prvý dostupný slot
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

  return (
    <form onSubmit={submit} className="w-full rounded border p-3 space-y-3">
      <div className="text-xs opacity-70">Dátum: <strong>{formatDateSK(date)}</strong></div>

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

      <p className="text-xs opacity-70">* Dni sa berú priamo zo slotov; víkendy fungujú.</p>
    </form>
  );
}
