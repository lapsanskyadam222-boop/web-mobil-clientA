// app/admin/slots/Client.tsx
'use client';

import { useMemo, useState } from 'react';

export type Slot = {
  id: string;
  date: string;     // YYYY-MM-DD
  time: string;     // HH:mm
  locked?: boolean;
  booked?: boolean;
  capacity?: number;
  bookedCount?: number;
};

type Props = { slots: Slot[] };

const WD = ['po','ut','st','št','pia','so','ne'];
const monthLabel = (d: Date) =>
  d.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

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
  for (let i=0;i<cells.length;i+=7) weeks.push(cells.slice(i,i+7));
  return weeks.filter(w => w.some(c => c.inMonth));
}

export default function AdminSlotsClient({ slots: initial }: Props) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    [...(initial ?? [])].sort((a,b)=> a.date===b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date))
  );

  const firstDate = slots[0]?.date ?? new Date().toISOString().slice(0,10);
  const [anchor, setAnchor] = useState(() => { const d=new Date(firstDate); d.setDate(1); return d; });
  const [activeDate, setActiveDate] = useState<string>(firstDate);

  const weeks = useMemo(() => buildCalendarWeeks(anchor.getFullYear(), anchor.getMonth()), [anchor]);

  const slotsByDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) {
      if (!m.has(s.date)) m.set(s.date, []);
      m.get(s.date)!.push(s);
    }
    for (const arr of m.values()) arr.sort((a,b)=> a.time.localeCompare(b.time));
    return m;
  }, [slots]);

  const daySlots = slotsByDay.get(activeDate) ?? [];
  const busySet = useMemo(() => new Set(slots.map(s=>s.date)), [slots]);
  const todayIso = new Date().toISOString().slice(0,10);

  const [newTimes, setNewTimes] = useState('');
  const [newCap, setNewCap]     = useState<number | ''>('');

  async function refetch() {
    const res = await fetch('/api/slots?t=' + Date.now(), { cache: 'no-store' });
    const j = await res.json();
    const list: Slot[] = Array.isArray(j?.slots) ? j.slots : [];
    setSlots(list.sort((a,b)=> a.date===b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
  }

  async function lockDay(lock: boolean) {
    await fetch('/api/slots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: activeDate, action: lock ? 'lockDay' : 'unlockDay' })
    });
    await refetch();
  }

  async function addTimes() {
    const raw = newTimes.split(',').map(s=>s.trim()).filter(Boolean);
    if (!raw.length) return alert('Zadaj aspoň jeden čas (napr. 13:00, 14:30).');
    const capacity = (typeof newCap === 'number' && newCap >= 1) ? newCap : undefined;

    const res = await fetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: activeDate, times: raw, capacity })
    });
    const j = await res.json();
    if (!res.ok) return alert(j?.error || 'Pridanie časov zlyhalo.');
    setNewTimes('');
    await refetch();
  }

  async function slotAction(id: string, action: 'lock'|'unlock'|'delete') {
    await fetch('/api/slots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action })
    });
    await refetch();
  }

  async function saveCapacity(id: string, cap: number) {
    const capacity = Math.max(1, Math.floor(cap));
    await fetch('/api/slots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'setCapacity', capacity })
    });
    await refetch();
  }

  const grid7: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 };
  const cellH = 48;

  const daySummary = (() => {
    const arr = daySlots;
    const total = arr.length;
    const locked = arr.filter(s=>s.locked).length;
    const booked = arr.filter(s=>s.booked || (s.capacity && (s.bookedCount ?? 0) >= s.capacity)).length;
    return { total, locked, booked };
  })();

  return (
    <main className="mx-auto max-w-screen-sm p-4">
      <h1 className="mb-2 text-xl font-semibold">Správa slotov</h1>
      <p className="text-sm opacity-70 mb-4">Kalendár mesiaca + nastavenia pre vybraný deň.</p>

      {/* Kalendár */}
      <div className="rounded border" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
        <div className="mb-3 flex items-center" style={{ justifyContent: 'space-between' }}>
          <button onClick={()=> setAnchor(new Date(anchor.getFullYear(), anchor.getMonth()-1, 1))}
                  className="rounded border px-2 py-1">‹</button>
          <div className="font-semibold" style={{ textTransform: 'capitalize' }}>{monthLabel(anchor)}</div>
          <button onClick={()=> setAnchor(new Date(anchor.getFullYear(), anchor.getMonth()+1, 1))}
                  className="rounded border px-2 py-1">›</button>
        </div>

        <div style={grid7} className="text-center text-sm mb-1">
          {WD.map(w => <div key={w} className="py-1 font-semibold">{w}</div>)}
        </div>

        <div style={{ display: 'grid', rowGap: 6 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={grid7}>
              {week.map(({ date, inMonth }, di) => {
                const iso = toISO(date);
                const isAct  = iso === activeDate;
                const isPast = iso < todayIso;
                const hasAny = busySet.has(iso);

                let styleBtn: React.CSSProperties = { height: cellH };
                let cls = 'rounded border flex items-center justify-center';
                if (!inMonth) { cls += ' text-gray-400'; styleBtn.background = '#f9fafb'; }
                else if (isAct) { cls += ' text-white'; styleBtn.background = '#000'; styleBtn.borderColor = '#000'; }
                else if (isPast) { cls += ' text-gray-400'; styleBtn.background = '#f3f4f6'; }
                else { /* clickable */ }

                return (
                  <button
                    key={di}
                    type="button"
                    className={cls}
                    style={styleBtn}
                    onClick={()=> setActiveDate(iso)}
                    title={iso}
                  >
                    <span className="text-sm">{date.getDate()}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Panel pre deň */}
      <div className="rounded border" style={{ padding: '0.75rem' }}>
        <div className="text-sm opacity-70">Vybraný dátum: <strong>{new Date(activeDate).toLocaleDateString('sk-SK')}</strong></div>

        <div className="flex gap-2" style={{ alignItems: 'center', marginTop: '.5rem', marginBottom: '.5rem' }}>
          <button onClick={()=> lockDay(true)}  className="rounded bg-black text-white px-2 py-1">Zamknúť deň</button>
          <button onClick={()=> lockDay(false)} className="rounded border px-2 py-1">Odomknúť deň</button>
          <div className="text-sm opacity-70" style={{ marginLeft: 'auto' }}>
            Stav: {daySummary.total} časov • {daySummary.locked} zamknutých • {daySummary.booked} obsadených
          </div>
        </div>

        {/* Pridať časy */}
        <div className="rounded border" style={{ padding: '0.75rem', marginBottom: '.75rem' }}>
          <div className="text-sm font-medium" style={{ marginBottom: '.5rem' }}>
            Pridať časy pre {new Date(activeDate).toLocaleDateString('sk-SK')}
          </div>
          <div className="grid" style={{ gap: '.5rem' }}>
            <input
              className="border rounded px-2 py-2"
              placeholder="napr. 13:00, 14:30, 18:00"
              value={newTimes}
              onChange={e=> setNewTimes(e.target.value)}
            />
            <div className="flex gap-2">
              <input
                className="border rounded px-2 py-2"
                placeholder="kapacita (nepovinné)"
                inputMode="numeric"
                value={newCap}
                onChange={e=> setNewCap(e.target.value ? Math.max(1, Math.floor(+e.target.value)) : '')}
                style={{ width: 140 }}
              />
              <button onClick={addTimes} className="rounded bg-black text-white px-2 py-2">Pridať</button>
            </div>
            <p className="text-xs opacity-70">Časy oddeľuj čiarkou. Kapacita je voliteľná.</p>
          </div>
        </div>

        {/* Zoznam časov */}
        <div className="rounded border">
          <div className="px-2 py-2 text-sm" style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
            Časy pre deň
          </div>
          {daySlots.length ? (
            <div>
              {daySlots.map((s, i) => (
                <div key={s.id}
                     className="px-2 py-2 flex gap-2 items-center"
                     style={i ? { borderTop: '1px solid #e5e7eb' } : undefined}>
                  <div style={{ minWidth: 64, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{s.time}</div>
                  <div className="text-sm opacity-70">
                    {s.locked ? 'Zamknuté'
                              : s.booked || (s.capacity && (s.bookedCount ?? 0) >= s.capacity) ? 'Obsadené'
                              : 'Voľné'}
                    {typeof s.capacity === 'number' && (
                      <> • kapacita {s.bookedCount ?? 0}/{s.capacity}</>
                    )}
                  </div>

                  <div className="flex gap-2" style={{ marginLeft: 'auto' }}>
                    <input
                      className="border rounded px-2 py-1"
                      inputMode="numeric"
                      defaultValue={s.capacity ?? ''}
                      placeholder="kapacita"
                      onBlur={e=>{
                        const v = e.currentTarget.value.trim();
                        if (v === '') return;
                        const n = Math.max(1, Math.floor(+v));
                        if (!Number.isFinite(n)) return;
                        void saveCapacity(s.id, n);
                      }}
                      title="Zadaj číslo a klikni mimo poľa (uloží sa)."
                      style={{ width: 92 }}
                    />
                    <button onClick={()=> slotAction(s.id, s.locked ? 'unlock' : 'lock')}
                            className="rounded border px-2 py-1">
                      {s.locked ? 'Odomknúť' : 'Zamknúť'}
                    </button>
                    <button onClick={()=> slotAction(s.id, 'delete')}
                            className="rounded border px-2 py-1">Vymazať</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 py-3 text-sm opacity-70">V tento deň zatiaľ nie sú žiadne časy.</div>
          )}
        </div>
      </div>
    </main>
  );
}
