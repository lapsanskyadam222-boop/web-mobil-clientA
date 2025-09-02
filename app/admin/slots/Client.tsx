'use client';

import React, { useMemo, useState } from 'react';

/** ===== Typy zdieľané s API ===== */
export type Slot = {
  id: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm
  locked?: boolean;   // slot zamknutý (nebookingovateľný)
  booked?: boolean;   // už rezervovaný
  capacity?: number;  // max počet ľudí
  bookedCount?: number; // koľko je už rezervovaných
};

type SlotsPayload = { slots: Slot[]; updatedAt: string };

/** ===== Pomocné funkcie ===== */
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
const WD = ['po', 'ut', 'st', 'št', 'pia', 'so', 'ne'];
const monthLabel = (d: Date) => d.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });

/** ===== FRONTa async operácií (aby PATCH/POST nešli naraz) ===== */
let op: Promise<void> = Promise.resolve();
function enqueue(fn: () => Promise<unknown>): Promise<void> {
  op = op
    .then(() => fn())
    .then(() => { /* normalize to void */ })
    .catch(() => { /* swallow to keep chain alive */ });
  return op;
}

/** ===== Volania API (vracajú vždy čerstvé slots) ===== */
async function apiGet(): Promise<Slot[]> {
  const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
  const j = (await res.json()) as SlotsPayload;
  return Array.isArray(j?.slots) ? j.slots : [];
}

async function apiPostAdd(toCreate: { date: string; time: string; capacity?: number }[]): Promise<Slot[]> {
  const res = await fetch('/api/slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots: toCreate }),
  });
  if (!res.ok) throw new Error('POST /slots zlyhalo');
  // po zápise načítaj čerstvé
  return apiGet();
}

async function apiPatch(body: unknown): Promise<Slot[]> {
  const res = await fetch('/api/slots', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('PATCH /slots zlyhalo');
  // API môže vracať slots, ale pre istotu vždy dočítame čerstvo
  return apiGet();
}

async function apiDelete(id: string): Promise<Slot[]> {
  const res = await fetch('/api/slots', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'delete' }),
  });
  if (!res.ok) throw new Error('DELETE slot zlyhalo');
  return apiGet();
}

/** ===== Admin komponent ===== */
export default function AdminSlotsClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newCap,  setNewCap]  = useState<number | ''>('');

  // kalendár – rovnaký štýl ako rezervačná stránka
  const initialAnchor = useMemo(() => {
    const first = slots.length ? slots[0].date : toISO(new Date());
    const d = new Date(first);
    d.setDate(1);
    d.setHours(0,0,0,0);
    return d;
  }, [slots]);

  const [anchor, setAnchor] = useState<Date>(initialAnchor);
  const [activeDate, setActiveDate] = useState<string>(toISO(new Date()));

  const byDate = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) {
      if (!m.has(s.date)) m.set(s.date, []);
      m.get(s.date)!.push(s);
    }
    for (const arr of m.values()) {
      arr.sort((a,b) => (a.time < b.time ? -1 : 1));
    }
    return m;
  }, [slots]);

  const daySlots = byDate.get(activeDate) ?? [];

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await apiGet();
        setSlots(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** ====== Admin akcie (všetky idú cez enqueue) ====== */

  async function refresh() {
    setLoading(true);
    try {
      const data = await apiGet();
      setSlots(data);
    } finally {
      setLoading(false);
    }
  }

  function addOne() {
    if (!newDate || !newTime) {
      alert('Vyplň dátum aj čas.');
      return;
    }
    const cap = typeof newCap === 'number' && Number.isFinite(newCap) ? Math.max(1, newCap) : 1;
    enqueue(async () => {
      const data = await apiPostAdd([{ date: newDate, time: newTime, capacity: cap }]);
      setSlots(data);
      setActiveDate(newDate);
      setNewTime('');
      setNewCap('');
    }).then(refresh).catch(() => {});
  }

  function lockSlot(s: Slot, lock: boolean) {
    enqueue(async () => {
      const data = await apiPatch({ id: s.id, date: s.date, time: s.time, action: lock ? 'lock' : 'unlock' });
      setSlots(data);
    }).then(refresh).catch(() => {});
  }

  function deleteOne(s: Slot) {
    if (!confirm(`Vymazať ${s.date} ${s.time}?`)) return;
    enqueue(async () => {
      const data = await apiDelete(s.id);
      setSlots(data);
    }).then(refresh).catch(() => {});
  }

  function changeCapacity(s: Slot, cap: number) {
    const safe = Number.isFinite(cap) ? Math.max(1, Math.round(cap)) : 1;
    enqueue(async () => {
      const data = await apiPatch({ id: s.id, date: s.date, time: s.time, action: 'capacity', capacity: safe });
      setSlots(data);
    }).then(refresh).catch(() => {});
  }

  function lockDay(dayISO: string, lock: boolean) {
    enqueue(async () => {
      const data = await apiPatch({ date: dayISO, action: lock ? 'lockDay' : 'unlockDay' });
      setSlots(data);
    }).then(refresh).catch(() => {});
  }

  /** ====== kalendár (rovnaká logika ako na /rezervacia) ====== */
  function buildCalendarWeeks(year: number, month0: number) {
    const first = new Date(year, month0, 1);
    const last  = new Date(year, month0 + 1, 0);

    const start = new Date(first);
    const day = start.getDay(); // 0=ne, 1=po...
    const diff = (day === 0 ? -6 : 1 - day);
    start.setDate(start.getDate() + diff);
    start.setHours(0,0,0,0);

    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i=0;i<42;i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push({ date: d, inMonth: d >= first && d <= last });
    }
    const weeks: { date: Date; inMonth: boolean }[][] = [];
    for (let i=0;i<cells.length; i+=7) weeks.push(cells.slice(i, i+7));
    return weeks.filter(week => week.some(c => c.inMonth));
  }

  const weeks = useMemo(() => buildCalendarWeeks(anchor.getFullYear(), anchor.getMonth()), [anchor]);
  const availableDates = useMemo(() => new Set(slots.map(s => s.date)), [slots]);
  const grid7: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 };
  const cellH = 56;

  function prevMonth() { const d = new Date(anchor); d.setMonth(d.getMonth()-1); setAnchor(d); }
  function nextMonth() { const d = new Date(anchor); d.setMonth(d.getMonth()+1); setAnchor(d); }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Správa slotov</h1>

      {/* Kalendár */}
      <div className="w-full mb-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={prevMonth} className="rounded border px-3 py-1 hover:bg-gray-50" aria-label="Predchádzajúci mesiac">‹</button>
          <div className="text-base font-semibold capitalize">{monthLabel(anchor)}</div>
          <button onClick={nextMonth} className="rounded border px-3 py-1 hover:bg-gray-50" aria-label="Nasledujúci mesiac">›</button>
        </div>

        <div style={grid7} className="text-center text-xs mb-1">
          {WD.map(w => (
            <div key={w} className="py-2 font-semibold opacity-70 uppercase">{w}</div>
          ))}
        </div>

        <div style={{ display: 'grid', rowGap: 6, marginBottom: 24 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={grid7}>
              {week.map(({ date, inMonth }, di) => {
                const iso = toISO(date);
                const isAct  = iso === activeDate;
                const hasAny = availableDates.has(iso);

                const common = 'rounded border flex items-center justify-center select-none';
                const style: React.CSSProperties = { height: cellH };

                let cls = '';
                if (!inMonth) cls = 'bg-gray-50 text-gray-300';
                else if (isAct) cls = 'bg-black text-white border-black';
                else if (hasAny) cls = 'bg-white hover:bg-gray-100 cursor-pointer';
                else cls = 'bg-gray-100 text-gray-400';

                return (
                  <button
                    type="button"
                    key={di}
                    onClick={() => setActiveDate(iso)}
                    title={iso}
                    className={`${common} ${cls}`}
                    style={style}
                  >
                    <span className="text-sm">{date.getDate()}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Ovládanie dňa */}
      <div className="mb-4 rounded border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm opacity-70">Dátum: <strong>{activeDate}</strong></div>
          <div className="space-x-2">
            <button
              className="rounded border px-3 py-1 hover:bg-gray-50"
              onClick={() => lockDay(activeDate, true)}
            >Zamknúť deň</button>
            <button
              className="rounded border px-3 py-1 hover:bg-gray-50"
              onClick={() => lockDay(activeDate, false)}
            >Odomknúť deň</button>
          </div>
        </div>

        {/* Form na pridanie slotu */}
        <div className="grid gap-2 sm:grid-cols-4 grid-cols-1">
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
          <input
            type="time"
            className="border rounded px-3 py-2"
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
            placeholder="HH:mm"
          />
          <input
            type="number"
            min={1}
            className="border rounded px-3 py-2"
            value={newCap}
            onChange={e => {
              const v = e.target.value;
              setNewCap(v === '' ? '' : Number(v));
            }}
            placeholder="Kapacita (min 1)"
          />
          <button
            className="rounded bg-black text-white px-3 py-2 hover:bg-gray-800"
            onClick={addOne}
          >Pridať 1</button>
        </div>
      </div>

      {/* Zoznam slotov pre vybraný deň */}
      <div className="rounded border p-3">
        <div className="text-sm font-semibold mb-2">Sloty pre {activeDate}:</div>
        {!daySlots.length && <div className="text-sm opacity-60">Žiadne sloty.</div>}
        <div className="space-y-2">
          {daySlots.map(s => (
            <div key={s.id} className="flex items-center justify-between rounded border px-3 py-2">
              <div className="text-sm min-w-0">
                <div className="font-medium">{s.time}</div>
                <div className="opacity-70">
                  {s.locked ? 'Zamknutý' : 'Voľné'} &middot; Kapacita: {s.capacity ?? 1} &middot; Rezervované: {s.bookedCount ?? 0}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs opacity-70">Kapacita</label>
                <input
                  type="number"
                  min={1}
                  defaultValue={s.capacity ?? 1}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v) || v < 1) { e.currentTarget.value = String(s.capacity ?? 1); return; }
                    if (v === (s.capacity ?? 1)) return;
                    changeCapacity(s, v);
                  }}
                  className="w-20 border rounded px-2 py-1 text-sm"
                />
                <button
                  className="rounded border px-3 py-1 hover:bg-gray-50"
                  onClick={() => lockSlot(s, !s.locked)}
                >
                  {s.locked ? 'Odomknúť' : 'Zamknúť'}
                </button>
                <button
                  className="rounded border px-3 py-1 hover:bg-gray-50"
                  onClick={() => deleteOne(s)}
                >
                  Vymazať
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stav */}
      <div className="mt-3 text-xs opacity-60">
        {loading ? 'Načítavam…' : `Slotov spolu: ${slots.length}`}
      </div>
    </main>
  );
}
