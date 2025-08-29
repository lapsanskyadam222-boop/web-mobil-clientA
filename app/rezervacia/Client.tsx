"use client";

import { useMemo, useState } from "react";

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toISODate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

// začiatok týždňa = pondelok
function startOfWeekMon(d: Date) {
  const day = d.getDay(); // 0 nedeľa .. 6 sobota
  const diff = (day === 0 ? -6 : 1 - day); // posun na pondelok
  const nd = new Date(d);
  nd.setDate(d.getDate() + diff);
  nd.setHours(0,0,0,0);
  return nd;
}

// vygeneruje mriežku mesiaca (týždne x dni)
function buildMonthGrid(year: number, monthIndex0: number) {
  // 1. deň mesiaca
  const first = new Date(year, monthIndex0, 1);
  const last = new Date(year, monthIndex0 + 1, 0);
  const firstCell = startOfWeekMon(first);

  const weeks: (Date | null)[][] = [];
  let cursor = new Date(firstCell);
  while (true) {
    const row: (Date | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const cell = new Date(cursor);
      if (cell < first || cell > last) {
        // mimo aktuálneho mesiaca – ukáž prázdny štvorček
        row.push(null);
      } else {
        row.push(cell);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(row);
    // skončíme, keď sme prešli posledný deň mesiaca a zároveň nedeľu
    if (weeks.length > 6 || (row[6] && row[6]! >= last)) break;
  }
  return weeks;
}

const skWeekdays = ["po", "ut", "st", "št", "pia", "so", "ne"];
const skMonth = (d: Date) =>
  d.toLocaleDateString("sk-SK", { month: "long", year: "numeric" });

export default function ClientRezervacia({ slots }: { slots: Slot[] }) {
  // dostupné sloty (od dneška, nie locked/booked)
  const todayIso = new Date().toISOString().slice(0,10);
  const available = useMemo(
    () => (slots || [])
      .filter(s => s.date >= todayIso && !s.locked && !s.booked)
      .sort((a,b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1)),
    [slots]
  );

  // set dostupných dátumov pre rýchle overenie
  const availableDates = useMemo(() => new Set(available.map(s => s.date)), [available]);

  // aktívny mesiac a vybraný deň
  const [monthAnchor, setMonthAnchor] = useState(() => {
    // predvolený mesiac = mesiac prvého dostupného slotu, inak dnešný
    const first = available[0]?.date ?? todayIso;
    const d = new Date(first);
    d.setDate(1);
    d.setHours(0,0,0,0);
    return d;
  });

  const [activeDate, setActiveDate] = useState(() => {
    const first = available[0]?.date ?? todayIso;
    return first;
  });

  // slots pre aktívny deň
  const dayTimes = useMemo(
    () => available.filter(s => s.date === activeDate).map(s => s.time),
    [available, activeDate]
  );

  const weeks = useMemo(
    () => buildMonthGrid(monthAnchor.getFullYear(), monthAnchor.getMonth()),
    [monthAnchor]
  );

  // ak nič nie je, zobraz správu
  if (!available.length) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Rezervácia</h1>
        <p className="text-sm opacity-70">
          Momentálne nie sú dostupné žiadne termíny. Skúste neskôr.
        </p>
      </main>
    );
  }

  // navigácia mesiaca
  function prevMonth() {
    const d = new Date(monthAnchor);
    d.setMonth(d.getMonth() - 1);
    setMonthAnchor(d);
  }
  function nextMonth() {
    const d = new Date(monthAnchor);
    d.setMonth(d.getMonth() + 1);
    setMonthAnchor(d);
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Rezervácia</h1>

      {/* Month header */}
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded border px-2 py-1 hover:bg-gray-50"
          aria-label="Predchádzajúci mesiac"
        >
          ‹
        </button>
        <div className="text-sm font-semibold">
          {skMonth(monthAnchor)}
        </div>
        <button
          onClick={nextMonth}
          className="rounded border px-2 py-1 hover:bg-gray-50"
          aria-label="Nasledujúci mesiac"
        >
          ›
        </button>
      </div>

      {/* Calendar grid */}
      <div className="mb-3">
        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
          {skWeekdays.map(w => (
            <div key={w} className="py-1 font-medium opacity-70">{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weeks.map((row, ri) =>
            row.map((cell, ci) => {
              if (!cell) {
                return <div key={`${ri}-${ci}`} className="aspect-square rounded border border-dashed opacity-30" />;
              }
              const iso = toISODate(cell);
              const isAv = availableDates.has(iso);
              const isActive = iso === activeDate;
              const isPast = iso < todayIso;

              const base = "aspect-square rounded border text-sm flex items-center justify-center";
              const state = isActive
                ? "bg-black text-white border-black"
                : isAv
                ? "hover:bg-gray-100 cursor-pointer"
                : "opacity-40";
              return (
                <button
                  type="button"
                  key={iso}
                  disabled={!isAv || isPast}
                  onClick={() => setActiveDate(iso)}
                  className={`${base} ${state}`}
                  title={iso}
                >
                  {cell.getDate()}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Formulár – spodok ostáva ako bol */}
      <SlotsForm date={activeDate} times={dayTimes} />
    </main>
  );
}

/* ----------------- Form ----------------- */

function SlotsForm({ date, times }: { date: string; times: string[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [time, setTime] = useState(() => times[0] ?? "");

  // ak sa zmení deň, presuň default time
  if (times.length && !times.includes(time)) {
    // nastaviť na prvý dostupný čas
    // (toto je safe, mimo render cyklu by sme použili useEffect, ale podmienka je idempotentná)
    // eslint-disable-next-line react-hooks/rules-of-hooks
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
        <select
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
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
        <input
          className="w-full border rounded px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="block text-xs mb-1">Telefón</span>
        <input
          className="w-full border rounded px-3 py-2"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>

      <button
        type="submit"
        className="w-full rounded bg-black text-white py-2 hover:bg-gray-800 disabled:opacity-50"
        disabled={!times.length}
      >
        Vybrať si termín
      </button>

      <p className="text-xs opacity-70">
        * Dni sa berú priamo zo slotov, takže víkendy fungujú.
      </p>
    </form>
  );
}
