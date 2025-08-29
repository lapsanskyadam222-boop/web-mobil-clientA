"use client";

import { useMemo, useState } from "react";

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };

function formatDayLabel(d: string) {
  const dt = new Date(d);
  const wd = dt.toLocaleDateString("sk-SK", { weekday: "short" }); // po, ut, st, ...
  const dm = dt.toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" }); // 5. 9.
  return `${wd} ${dm}`;
}

export default function ClientRezervacia({ slots }: { slots: Slot[] }) {
  // voľné, neuzamknuté a od dneška – aby sa dala rezervovať len budúcnosť
  const today = new Date().toISOString().slice(0, 10);
  const available = useMemo(
    () =>
      (slots || [])
        .filter((s) => s.date >= today && !s.locked && !s.booked)
        .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1)),
    [slots]
  );

  const days = useMemo(() => Array.from(new Set(available.map((s) => s.date))), [available]);

  if (!days.length) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Rezervácia</h1>
        <p className="text-sm opacity-70">Momentálne nie sú dostupné žiadne termíny. Skúste neskôr.</p>
      </main>
    );
  }

  const [active, setActive] = useState(days[0]);
  const times = useMemo(
    () => available.filter((s) => s.date === active).map((s) => s.time),
    [available, active]
  );

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-3 text-2xl font-bold">Rezervácia</h1>

      {/* Tabs s dňami zo slotov (vrátane víkendov, ak existujú) */}
      <div className="mb-3 flex flex-wrap gap-2">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setActive(d)}
            className={`rounded px-2 py-1 text-sm border ${active === d ? "bg-black text-white" : "bg-white hover:bg-gray-50"}`}
            title={new Date(d).toLocaleDateString("sk-SK")}
          >
            {formatDayLabel(d)}
          </button>
        ))}
      </div>

      <SlotsForm date={active} times={times} />
    </main>
  );
}

function SlotsForm({ date, times }: { date: string; times: string[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [time, setTime] = useState(times[0] ?? "");

  // keď sa zmení deň, vyber prvý dostupný čas
  if (times.length && !times.includes(time)) {
    setTime(times[0]);
  }

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
        Dátum:{" "}
        <strong>
          {new Date(date).toLocaleDateString("sk-SK", {
            day: "numeric",
            month: "numeric",
            year: "numeric",
          })}
        </strong>
      </div>

      <label className="block">
        <span className="block text-xs mb-1">Čas</span>
        <select value={time} onChange={(e) => setTime(e.target.value)} className="w-full border rounded px-3 py-2">
          {times.length ? (
            times.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))
          ) : (
            <option value="" disabled>
              Žiadne časy v tento deň
            </option>
          )}
        </select>
      </label>

      <label className="block">
        <span className="block text-xs mb-1">Meno</span>
        <input className="w-full border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="block">
        <span className="block text-xs mb-1">Telefón</span>
        <input className="w-full border rounded px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>

      <button type="submit" className="w-full rounded bg-black text-white py-2 hover:bg-gray-800" disabled={!times.length}>
        Vybrať si termín
      </button>

      <p className="text-xs opacity-70">* Sloty sa berú priamo z /api/slots (fungujú aj víkendy).</p>
    </form>
  );
}
