'use client';

import { useEffect, useState } from 'react';

type Slot = {
  id: string;
  date: string;
  time: string;
  locked?: boolean;
  booked?: boolean;
  capacity?: number;
  bookedCount?: number;
};
type SlotsPayload = { slots: Slot[]; updatedAt: string };

export default function AdminSlotsClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newCap, setNewCap] = useState(1);

  // jednoduchá fronta operácií (garantuje poradie a „fire-and-forget“)
  let chain = Promise.resolve();
  function enqueue(fn: () => Promise<any>): Promise<void> {
    chain = chain.then(fn, fn).then(() => undefined, () => undefined);
    return chain;
  }

  async function fetchFresh() {
    const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
    const j = (await res.json()) as SlotsPayload | any;
    setSlots(Array.isArray(j?.slots) ? j.slots : []);
  }

  useEffect(() => {
    fetchFresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // Akcie

  function addOne() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || !/^\d{2}:\d{2}$/.test(newTime)) {
      alert('Zadaj dátum (YYYY-MM-DD) a čas (HH:mm).');
      return;
    }
    const cap = Number.isFinite(+newCap) ? Math.max(1, +newCap) : 1;

    setLoading(true);
    enqueue(async () => {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: [{ date: newDate, time: newTime, capacity: cap }] }),
      });
      if (!res.ok) alert((await res.json())?.error ?? 'Chyba slots[]');
    }).then(() => fetchFresh().finally(() => setLoading(false)));
  }

  function lockDay(date: string, lock: boolean) {
    setLoading(true);
    enqueue(async () => {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, action: lock ? 'lockDay' : 'unlockDay' }),
      });
    }).then(() => fetchFresh().finally(() => setLoading(false)));
  }

  function lockSlot(id: string, lock: boolean) {
    setLoading(true);
    enqueue(async () => {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: lock ? 'lock' : 'unlock' }),
      });
    }).then(() => fetchFresh().finally(() => setLoading(false)));
  }

  function changeCap(id: string, cap: number) {
    const safe = Number.isFinite(+cap) ? Math.max(1, +cap) : 1;
    // optimisticky v UI hneď
    setSlots(prev => prev.map(s => (s.id === id ? { ...s, capacity: safe } : s)));
    enqueue(async () => {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'capacity', capacity: safe }),
      });
    }).then(() => fetchFresh().catch(() => {}));
  }

  function remove(id: string) {
    setLoading(true);
    enqueue(async () => {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      });
    }).then(() => fetchFresh().finally(() => setLoading(false)));
  }

  async function wipeAll() {
    if (!confirm('Naozaj vymazať všetky sloty?')) return;
    setLoading(true);
    await enqueue(async () => { await fetch('/api/slots', { method: 'DELETE' }); });
    await fetchFresh();
    setLoading(false);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // render

  // zoskupiť podľa dňa
  const byDay = new Map<string, Slot[]>();
  for (const s of slots.sort((a,b) => a.date===b.date ? (a.time<b.time?-1:1) : (a.date<b.date?-1:1))) {
    if (!byDay.has(s.date)) byDay.set(s.date, []);
    byDay.get(s.date)!.push(s);
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Správa slotov</h1>

      <div className="mb-3 flex items-center gap-2">
        <input
          placeholder="rrrr-mm-dd"
          value={newDate}
          onChange={e=>setNewDate(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          placeholder="hh:mm"
          value={newTime}
          onChange={e=>setNewTime(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          type="number"
          min={1}
          value={newCap}
          onChange={e=>setNewCap(+e.target.value)}
          className="border rounded px-2 py-1 w-20 text-sm"
          title="Kapacita"
        />
        <button
          disabled={loading}
          onClick={addOne}
          className="px-3 py-1 rounded bg-black text-white text-sm"
        >
          Pridať 1
        </button>
        <button
          disabled={loading}
          onClick={wipeAll}
          className="px-3 py-1 rounded border text-sm"
          title="Vymaže úplne všetko"
        >
          Vymazať všetky
        </button>
      </div>

      {/* tabuľka podľa dní */}
      <div className="rounded border divide-y">
        {[...byDay.entries()].map(([date, arr]) => (
          <div key={date} className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium">{date}</div>
              <div className="flex gap-2">
                <button className="px-2 py-1 text-xs rounded border" onClick={()=>lockDay(date, true)}>Zamknúť deň</button>
                <button className="px-2 py-1 text-xs rounded border" onClick={()=>lockDay(date, false)}>Odomknúť deň</button>
              </div>
            </div>

            <div className="grid grid-cols-[100px_1fr_1fr_1fr] gap-2 text-sm">
              {arr.map(s => (
                <div key={s.id} className="contents">
                  <div className="px-2 py-1 rounded border text-center">{s.time}</div>
                  <div className="px-2 py-1 rounded border">
                    Kapacita:{' '}
                    <input
                      type="number"
                      min={1}
                      defaultValue={s.capacity ?? 1}
                      onBlur={(e)=>changeCap(s.id, +e.target.value)}
                      className="w-20 border rounded px-1 py-[2px] ml-2"
                      title="Zmeniť kapacitu"
                    />
                  </div>
                  <div className="px-2 py-1 rounded border">
                    Stav: {s.locked ? 'Zamknuté' : 'Voľné'}{s.booked ? ' · Rezervované' : ''}
                  </div>
                  <div className="px-2 py-1 flex gap-2">
                    <button className="px-2 py-1 text-xs rounded border" onClick={()=>lockSlot(s.id, true)}>Zamknúť</button>
                    <button className="px-2 py-1 text-xs rounded border" onClick={()=>lockSlot(s.id, false)}>Odomknúť</button>
                    <button className="px-2 py-1 text-xs rounded border" onClick={()=>remove(s.id)}>Vymazať</button>
                  </div>
                </div>
              ))}
              {arr.length === 0 && <div className="text-xs opacity-60">Žiadne časy.</div>}
            </div>
          </div>
        ))}
        {byDay.size === 0 && (
          <div className="p-4 text-sm opacity-70">Zatiaľ nie sú žiadne sloty.</div>
        )}
      </div>
    </main>
  );
}
