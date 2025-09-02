'use client';

import { useEffect, useMemo, useState } from 'react';

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

// jednoduchý mutex / fronta operácií (typovo čisté)
let inFlight: Promise<void> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = inFlight.then(() => fn());
  // ďalšiu operáciu spúšťame až keď táto skončí (úspech/ chyba)
  inFlight = next.then(
    () => {},
    () => {}
  );
  return next;
}

export default function AdminSlotsClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  // form
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newCap, setNewCap] = useState<number | ''>('');

  async function refreshFromServer() {
    const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
    const json = (await res.json()) as SlotsPayload | { error?: string };
    if ('slots' in json) setSlots(json.slots ?? []);
    else alert(json?.error || 'Načítanie slotov zlyhalo');
  }

  useEffect(() => {
    refreshFromServer().catch(() => {});
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    for (const [, arr] of map) arr.sort((a, b) => (a.time < b.time ? -1 : 1));
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [slots]);

  async function addOne() {
    const cap = typeof newCap === 'number' ? newCap : 1;
    if (!newDate || !newTime) return alert('Zadaj dátum aj čas.');
    setLoading(true);
    try {
      await enqueue(async () => {
        const res = await fetch('/api/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: newDate, time: newTime, capacity: cap }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || 'POST zlyhalo');
      });
      await refreshFromServer();
      setNewTime('');
    } catch (e: any) {
      alert(e?.message || 'Chyba slotu');
    } finally {
      setLoading(false);
    }
  }

  async function lockDay(date: string, lock: boolean) {
    setLoading(true);
    try {
      await enqueue(async () => {
        const res = await fetch('/api/slots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, action: lock ? 'lockDay' : 'unlockDay' }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || 'PATCH deň zlyhal');
      });
      await refreshFromServer();
    } catch (e: any) {
      alert(e?.message || 'Chyba operácie');
    } finally {
      setLoading(false);
    }
  }

  async function toggleLock(s: Slot, lock: boolean) {
    setLoading(true);
    try {
      await enqueue(async () => {
        const res = await fetch('/api/slots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: s.id, action: lock ? 'lock' : 'unlock' }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || 'PATCH zlyhal');
      });
      await refreshFromServer();
    } catch (e: any) {
      alert(e?.message || 'Chyba operácie');
    } finally {
      setLoading(false);
    }
  }

  async function changeCap(s: Slot, cap: number) {
    if (!Number.isFinite(cap) || cap < 1) return;
    setLoading(true);
    try {
      await enqueue(async () => {
        const res = await fetch('/api/slots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: s.id, action: 'capacity', capacity: cap }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || 'PATCH capacity zlyhal');
      });
      await refreshFromServer();
    } catch (e: any) {
      alert(e?.message || 'Chyba operácie');
    } finally {
      setLoading(false);
    }
  }

  async function del(s: Slot) {
    if (!confirm(`Vymazať ${s.date} ${s.time}?`)) return;
    setLoading(true);
    try {
      await enqueue(async () => {
        const res = await fetch('/api/slots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: s.id, action: 'delete' }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || 'DELETE slot zlyhal');
      });
      await refreshFromServer();
    } catch (e: any) {
      alert(e?.message || 'Chyba operácie');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-2 text-2xl font-semibold">Správa slotov</h1>

      <div className="mb-3 flex gap-2 items-end">
        <label className="flex flex-col text-sm">
          Dátum
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="border rounded px-2 py-1" />
        </label>
        <label className="flex flex-col text-sm">
          Čas
          <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="border rounded px-2 py-1" />
        </label>
        <label className="flex flex-col text-sm">
          Kapacita
          <input
            type="number"
            min={1}
            value={newCap}
            onChange={e => setNewCap(e.target.value ? Number(e.target.value) : '')}
            className="border rounded px-2 py-1 w-24"
          />
        </label>
        <button
          onClick={addOne}
          disabled={loading}
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          Pridať
        </button>
      </div>

      <div className="space-y-4">
        {byDate.map(([date, arr]) => (
          <div key={date} className="rounded border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium">{date}</div>
              <div className="space-x-2">
                <button onClick={() => lockDay(date, true)}  className="px-2 py-1 text-sm rounded border">Zamknúť deň</button>
                <button onClick={() => lockDay(date, false)} className="px-2 py-1 text-sm rounded border">Odomknúť deň</button>
              </div>
            </div>
            <div className="space-y-2">
              {arr.map(s => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <div className="w-16">{s.time}</div>
                  <div className="w-20">stav: {s.locked ? 'Zamknutý' : 'Voľné'}</div>
                  <div className="w-36">
                    kapacita:{' '}
                    <input
                      type="number"
                      min={1}
                      defaultValue={s.capacity ?? 1}
                      onBlur={e => changeCap(s, Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 border rounded px-1 py-0.5"
                    />
                  </div>
                  <div className="space-x-2">
                    <button onClick={() => toggleLock(s, true)}  className="px-2 py-1 rounded border">Zamknúť</button>
                    <button onClick={() => toggleLock(s, false)} className="px-2 py-1 rounded border">Odomknúť</button>
                    <button onClick={() => del(s)} className="px-2 py-1 rounded border">Vymazať</button>
                  </div>
                </div>
              ))}
              {!arr.length && <div className="text-sm opacity-60">Žiadne sloty.</div>}
            </div>
          </div>
        ))}
        {!byDate.length && <div className="opacity-60 text-sm">Zatiaľ žiadne sloty.</div>}
      </div>
    </main>
  );
}
