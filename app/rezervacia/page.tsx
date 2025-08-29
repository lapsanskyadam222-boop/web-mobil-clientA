// app/rezervacia/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { use } from "react";

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };

async function getSlots(): Promise<Slot[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/slots?t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.slots) ? (json.slots as Slot[]) : [];
}

function formatDayLabel(d: string) {
  // d je "YYYY-MM-DD"
  const dt = new Date(d);
  const wd = dt.toLocaleDateString("sk-SK", { weekday: "short" }); // po, ut, st, ...
  const date = dt.toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" }); // 5. 9.
  return `${wd} ${date}`;
}

export default function RezervaciaPage() {
  // server component – môžeme "use" sľub
  const slots = use(getSlots());

  // len budúcnosť + neuzamknuté / nezarezervované pre výber
  const nowISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const available = slots
    .filter(s => s.date >= nowISO && !s.locked && !s.booked)
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1));

  // unikátne dátumy zo slotov (vrátane soboty/nedele, ak existujú)
  const days = Array.from(new Set(available.map(s => s.date)));

  // ak nemáme nič, ukáž správu
  if (!days.length) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Rezervácia</h1>
        <p className="text-sm opacity-70">Momentálne nie sú dostupné žiadne termíny. Skúste neskôr.</p>
      </main>
    );
  }

  // predvolený deň = prvý dostupný
  const defaultDay = days[0];

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Rezervácia</h1>

      {/* Tabs s dňami vytvorenými zo slotov (žiadne filtrovanie víkendov) */}
      <DayTabs days={days} slots={available} defaultDay={defaultDay} />
    </main>
  );
}

/* ---------- Client part (tabs + formulár) ---------- */
"use client";
import { useMemo, useState } from "react";

function DayTabs({ days, slots, defaultDay }: { days: string[]; slots: Slot[]; defaultDay: string }) {
  const [active, setActive] = useState(defaultDay);
  const daySlots = useMemo(
    () => slots.filter(s => s.date === active).sort((a, b) => (a.time < b.time ? -1 : 1)),
    [active, slots]
  );

  return (
    <div className="w-full">
      <div className="mb-3 flex gap-2">
        {days.map(d => (
          <button
            key={d}
            onClick={() => setActive(d)}
            className={`rounded px-2 py-1 text-sm border ${active === d ? "bg-black text-white" : "bg-white"}`}
          >
            {formatDayLabel(d)}
          </button>
        ))}
      </div>

      <SlotsForm date={active} times={daySlots.map(s => s.time)} />
    </div>
  );
}

function SlotsForm({ date, times }: { date: string; times: string[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [time, setTime] = useState(times[0] ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!time) return alert("Vyber čas");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, name, phone }),
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
      <div className="text-xs opacity-70">
        Dátum: <strong>{new Date(date).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" })}</strong>
      </div>

      <label className="block">
        <span className="block text-xs mb-1">Čas</span>
        <select
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          {times.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-xs mb-1">Meno</span>
        <input className="w-full border rounded px-3 py-2" value={name} onChange={e => setName(e.target.value)} />
      </label>

      <label className="block">
        <span className="block text-xs mb-1">Telefón</span>
        <input className="w-full border rounded px-3 py-2" value={phone} onChange={e => setPhone(e.target.value)} />
      </label>

      <button type="submit" className="w-full rounded bg-black text-white py-2 hover:bg-gray-800">
        Vybrať si termín
      </button>

      <p className="text-xs opacity-70">* Sloty sa čítajú z /api/slots a víkendy sú povolené.</p>
    </form>
  );
}
