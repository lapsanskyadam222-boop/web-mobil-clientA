// app/admin/slots/Client.tsx
'use client';

import * as React from 'react';

export type Slot = {
  id: string;
  date: string;    // YYYY-MM-DD
  time: string;    // HH:mm
  locked?: boolean;
  booked?: boolean;
  capacity?: number;
  bookedCount?: number;
};

type Props = {
  initial: Slot[];
};

const WD = ['po','ut','st','št','pia','so','ne'];
const monthLabel = (d: Date) =>
  d.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toISO(d: Date)  { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function buildCalendarWeeks(year: number, month0: number) {
  const first = new Date(year, month0, 1);
  const last  = new Date(year, month0 + 1, 0);

  // začiatok na pondelku
  const start = new Date(first);
  const day = start.getDay(); // 0=ne
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
  return weeks.filter(w => w.some(c => c.inMonth)); // len týždne s daným mesiacom
}

export default function AdminSlotsClient({ initial }: Props) {
  // stav
  const [slots, setSlots] = React.useState<Slot[]>(
    (initial ?? []).slice().sort((a,b)=> a.date===b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date))
  );

  // kotva kalendára = 1. deň mesiaca z prvého slotu, alebo dnešok
  const firstDate = slots[0]?.date ?? new Date().toISOString().slice(0,10);
  const [anchor, setAnchor] = React.useState<Date>(() => { const d = new Date(firstDate); d.setDate(1); return d; });
  // zvolený deň = ak existuje, ten prvý; inak dnešok
  const [activeDate, setActiveDate] = React.useState<string>(firstDate);

  const [newTimes, setNewTimes] = React.useState<string>(''); // "13:00, 14:00"
  const [newCap, setNewCap]     = React.useState<number>(1);

  const weeks = React.useMemo(() => buildCalendarWeeks(anchor.getFullYear(), anchor.getMonth()), [anchor]);

  // map dátum -> či sú sloty pre daný deň
  const datesWithSlots = React.useMemo(() => {
    const s = new Set<string>();
    for (const sl of slots) s.add(sl.date);
    return s;
  }, [slots]);

  const daySlots = React.useMemo(() =>
    slots.filter(s => s.date === activeDate).sort((a,b)=> a.time.localeCompare(b.time)),
  [slots, activeDate]);

  function prevMonth() { const d = new Date(anchor); d.setMonth(d.getMonth()-1); setAnchor(d); }
  function nextMonth() { const d = new Date(anchor); d.setMonth(d.getMonth()+1); setAnchor(d); }

  // ---------- IO helpery ----------
  async function refetch() {
    try {
      const res = await fetch('/api/slots?t=' + Date.now(), { cache: 'no-store' });
      const j = await res.json();
      const list: Slot[] = Array.isArray(j?.slots) ? j.slots : [];
      list.sort((a,b)=> a.date===b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date));
      setSlots(list);
    } catch (e:any) {
      alert(e?.message || 'Nepodarilo sa obnoviť zoznam slotov.');
    }
  }

  async function lockDay(lock: boolean) {
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: activeDate, action: lock ? 'lockDay' : 'unlockDay' })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Operácia zlyhala.');
      if (Array.isArray(j?.slots)) setSlots(j.slots); else await refetch();
    } catch (e:any) {
      alert(e?.message || 'Operácia zlyhala.');
    }
  }

  async function addTimes() {
    try {
      const raw = newTimes.split(',').map(s=>s.trim()).filter(Boolean);
      if (!raw.length) return alert('Zadaj aspoň jeden čas (napr. 13:00, 14:30).');
      const capacity = (typeof newCap === 'number' && newCap >= 1) ? newCap : undefined;

      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: activeDate, times: raw, capacity })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Pridanie časov zlyhalo.');
      setNewTimes('');
      if (Array.isArray(j?.slots)) setSlots(j.slots); else await refetch();
    } catch (e:any) {
      alert(e?.message || 'Pridanie časov zlyhalo.');
    }
  }

  async function slotAction(id: string, action: 'lock'|'unlock'|'delete') {
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Operácia zlyhala.');
      if (Array.isArray(j?.slots)) setSlots(j.slots); else await refetch();
    } catch (e:any) {
      alert(e?.message || 'Operácia zlyhala.');
    }
  }

  async function saveCapacity(id: string, cap: number) {
    try {
      const capacity = Math.max(1, Math.floor(cap));
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'setCapacity', capacity })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Uloženie kapacity zlyhalo.');
      if (Array.isArray(j?.slots)) setSlots(j.slots); else await refetch();
    } catch (e:any) {
      alert(e?.message || 'Uloženie kapacity zlyhalo.');
    }
  }

  // ---------- UI ----------
  const grid7: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 };
  const cellH = 44;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Správa slotov</h1>
      <p className="mb-4 text-sm opacity-70">Kalendár + nastavenia pre konkrétny deň.</p>

      {/* kalendár */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={prevMonth} className="rounded border px-3 py-1 hover:bg-gray-50" aria-label="Predchádzajúci mesiac">‹</button>
          <div className="text-base font-semibold capitalize">{monthLabel(anchor)}</div>
          <button onClick={nextMonth} className="rounded border px-3 py-1 hover:bg-gray-50" aria-label="Nasledujúci mesiac">›</button>
        </div>

        <div style={grid7} className="text-center text-xs mb-1">
          {WD.map(w => <div key={w} className="py-2 font-semibold opacity-70 uppercase">{w}</div>)}
        </div>

        <div style={{ display: 'grid', rowGap: 6 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={grid7}>
              {week.map(({ date, inMonth }, di) => {
                const iso = toISO(date);
                const has = datesWithSlots.has(iso);
                const isAct = iso === activeDate;

                const common = "rounded border flex items-center justify-center select-none";
                const style: React.CSSProperties = { height: cellH };

                let cls = "";
                if (!inMonth) cls = "bg-gray-50 text-gray-300";
                else if (isAct) cls = "bg-black text-white border-black";
                else if (has) cls = "bg-white hover:bg-gray-100 cursor-pointer";
                else cls = "bg-gray-100 text-gray-400";

                return (
                  <button
                    type="button"
                    key={di}
                    disabled={!inMonth || !has}
                    onClick={()=> setActiveDate(iso)}
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

      {/* panel pre zvolený deň */}
      <section className="rounded border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm">Deň: <strong>{activeDate}</strong></div>
          <div className="space-x-2">
            <button onClick={()=>lockDay(true)}  className="rounded border px-3 py-1 text-sm hover:bg-gray-50">Zamknúť deň</button>
            <button onClick={()=>lockDay(false)} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">Odomknúť deň</button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-2">
          <div className="md:col-span-2">
            <label className="block text-xs mb-1">Pridať časy (oddelené čiarkou)</label>
            <input
              value={newTimes}
              onChange={e=>setNewTimes(e.target.value)}
              placeholder="napr. 13:00, 14:30"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs mb-1">Kapacita (pre nové časy)</label>
            <input
              type="number" min={1}
              value={newCap}
              onChange={e=>setNewCap(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <div>
          <button onClick={addTimes} className="w-full rounded bg-black text-white py-2 hover:bg-gray-800">Pridať</button>
        </div>

        <div>
          <h3 className="mb-2 font-semibold">Existujúce časy</h3>
          {daySlots.length === 0 ? (
            <p className="text-sm opacity-70">Žiadne sloty pre tento deň.</p>
          ) : (
            <div className="space-y-2">
              {daySlots.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="w-24 text-sm">{s.time}</div>
                  <div className="w-28">
                    <input
                      type="number" min={1}
                      defaultValue={s.capacity ?? 1}
                      onBlur={(e)=> saveCapacity(s.id, Number(e.target.value))}
                      className="w-full border rounded px-2 py-1 text-sm"
                      title="Kapacita (uloží sa pri opustení poľa)"
                    />
                  </div>
                  <div className="text-xs opacity-70 w-24">
                    {s.locked ? 'Zamknutý' : (s.booked ? 'Rezervovaný' : 'Voľné')}
                  </div>
                  <div className="ml-auto space-x-2">
                    {s.locked
                      ? <button onClick={()=>slotAction(s.id,'unlock')} className="rounded border px-2 py-1 text-xs hover:bg-gray-50">Odomknúť</button>
                      : <button onClick={()=>slotAction(s.id,'lock')}   className="rounded border px-2 py-1 text-xs hover:bg-gray-50">Zamknúť</button>}
                    <button onClick={()=>slotAction(s.id,'delete')} className="rounded border px-2 py-1 text-xs hover:bg-gray-50">Vymazať</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
