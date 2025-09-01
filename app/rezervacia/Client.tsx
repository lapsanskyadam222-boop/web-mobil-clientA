"use client";

import { useMemo, useState } from "react";

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };

function formatDayLabel(d: string) {
  const dt = new Date(d);
  const wd = dt.toLocaleDateString("sk-SK", { weekday: "short" });
  const dm = dt.toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });
  return `${wd} ${dm}`;
}

export default function ClientRezervacia({ slots }: { slots: Slot[] }) {
  const today = new Date().toISOString().slice(0, 10);

  // iba budúce, neuzamknuté a nezarezervované
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

  const [activeDate, setActiveDate] = useState(days[0]);

  // sloty (s id!) pre aktívny deň
  const daySlots = useMemo(
    () => available.filter((s) => s.date === activeDate).sort((a, b) => (a.time < b.time ? -1 : 1)),
    [available, activeDate]
  );

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-3 text-2xl font-bold">Rezervácia</h1>

      <div className="mb-3 flex flex-wrap gap-2">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDate(d)}
            className={`rounded px-2 py-1 text-sm border ${
              activeDate === d ? "bg-black text-white" : "bg-white hover:bg-gray-50"
            }`}
            title={new Date(d).toLocaleDateString("sk-SK")}
          >
            {formatDayLabel(d)}
          </button>
        ))}
      </div>

      <SlotsForm date={activeDate} daySlots={daySlots} />
    </main>
  );
}

function SlotsForm({ date, daySlots }: { date: string; daySlots: Slot[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // vybraný slotId (nie len čas!)
  const [slotId, setSlotId] = useState<string>(daySlots[0]?.id ?? "");

  // keď sa zmení deň (prídu iné sloty), zvoľ prvý
  if (daySlots.length && !daySlots.find((s) => s.id === slotId)) {
    setSlotId(daySlots[0].id);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!slotId) return alert("Vyber čas.");
    if (!name.trim()) return alert("Zadaj meno.");
    if (!phone.trim()) return alert("Zadaj telefón.");

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, name: name.trim(), phone: phone.trim() }),
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
          {new Date(date).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" })}
        </strong>
      </div>

      <label className="block">
        <span className="block text-xs mb-1">Čas</span>
        <select
          value={slotId}
          onChange={(e) => setSlotId(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          {daySlots.length ? (
            daySlots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.time}
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

      <button type="submit" className="w-full rounded bg-black text-white py-2 hover:bg-gray-800" disabled={!daySlots.length}>
        Vybrať si termín
      </button>

      <p className="text-xs opacity-70">* Posielame slotId, meno a telefón.</p>
    </form>
  );
}
