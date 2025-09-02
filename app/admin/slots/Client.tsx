// app/admin/slots/Client.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Slot = {
  id: string;
  date: string;  // YYYY-MM-DD
  time: string;  // HH:mm
  locked?: boolean;
  booked?: boolean;
  capacity?: number;
  bookedCount?: number;
};

type SlotsPayload = { slots: Slot[]; updatedAt: string };

// ---- serializácia operácií (žiadne súbežné PATCH/POST) ----
let op = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  op = op.then(fn, fn); // aj po chybe pokračujeme
  return op as Promise<T>;
}

export default function AdminSlotsClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newCap, setNewCap] = useState(1);

  async function refreshFromServer() {
    const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
    const j = (await res.json()) as SlotsPayload;
    setSlots(Array.isArray(j?.slots) ? j.slots : []);
  }

  useEffect(() => {
    refreshFromServer();
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    }
    for (const [k, v] of map) v.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [slots]);

  // ---- mutačné akcie ----

  async function addSlot() {
    if (!newDate || !newTime) return alert('Zadaj dátum aj čas');
    setLoading(true);
    try {
      await enqueue(async () => {
        const res = await fetch('/api/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slots: [{ date: newDate, time: newTime, capacity: newCap }] }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || 'POST zlyhalo');
        await refreshFromServer();
      });
      setNewTime('');
    } catch (e: any) {
      alert(e?.message || 'Chyba pri pridávaní');
    } finally {
      setLoading(false);
    }
  }

  async function toggleSlotLock(s: Slot, lock: boolean) {
    setLoading(true);
    try {
      await enqueue(async () => {
        const res = await fetch('/api/slots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: s.id, date: s.date, time: s.time, action: lock ? 'lock' : 'unlock' }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || 'PATCH lock zlyhalo');
        await refreshFromServer();
      });
    } catch (e: any) {
      alert(e?.message || 'Chyba pri zámku');
    } finally {
      setLoading(false);
    }
  }

  async function changeCapacity(s: Slot, cap: number) {
    setLoading(true);
    try {
      await enqueue(async () => {
        const res = await fetch('/api/slots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: s.id, date: s.date, time: s.time, action: 'capacity', capacity: cap }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || 'PATCH capacity zlyhalo');
        await refreshFromServer();
      });
    } catch (e: any) {
      alert(e?.message || 'Chyba pri zmene kapacity');
    } finally {
      setLoading(false);
    }
  }

  async function deleteSlot(s: Slot) {
    if (!confirm(`Vymazať ${s.date} ${s.time}?`)) return;
    setLoading(true);
    try {
      await enqueue(async () => {
        const res = await fetch('/api/slots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: s.id, date: s.date, time: s.time, action: 'delete' }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || 'DELETE zlyhalo');
        await refreshFromServer();
      });
    } catch (e: any) {
      alert(e?.message || 'Chyba pri mazaní');
    } finally {
      setLoading(false);
    }
  }

  async function toggleDayLock(date: string, lock: boolean) {
    setLoading(true);
    try {
      await enqueue(async () => {
        const res = await fetch('/api/slots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, action: lock ? 'lockDay' : 'unlockDay' }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || 'PATCH lockDay zlyhalo');
        await refreshFromServer();
      });
    } catch (e: any) {
      alert(e?.message || 'Chyba pri (od)zamknutí dňa');
    } finally {
      setLoading(false);
    }
  }

  // ---- UI (jednoduché a prehľadné) ----

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Správa slotov</h1>

      <div className="rounded border p-3 mb-6">
        <div className="text-sm font-medium mb-2">Pridať slot</div>
        <div className="flex gap-2 items-center flex-wrap">
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="border rounded px-2 py-1" />
          <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="border rounded px-2 py-1" />
          <input type="number" min={1} value={newCap} onChange={e => setNewCap(Math.max(1, Number(e.target.value) || 1))} className="border rounded px-2 py-1 w-24" />
          <button onClick={addSlot} disabled={loading} className="px-3 py-1 rounded bg-black text-white">
            Pridať
          </button>
        </div>
      </div>

      {byDay.length === 0 && <p className="opacity-70">Zatiaľ žiadne sloty.</p>}

      <div className="space-y-4">
        {byDay.map(([date, daySlots]) => {
          const allLocked = daySlots.every(s => s.locked);
          return (
            <div key={date} className="rounded border">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                <div className="font-medium">{date}</div>
                <div className="flex gap-2">
                  <button
                    className="px-2 py-1 rounded border"
                    onClick={() => toggleDayLock(date, !allLocked)}
                    disabled={loading}
                  >
                    {allLocked ? 'Odomknúť deň' : 'Zamknúť deň'}
                  </button>
                </div>
              </div>

              <div className="divide-y">
                {daySlots.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="w-16 tabular-nums">{s.time}</div>
                    <div className="text-xs px-2 py-0.5 rounded border">{s.locked ? 'Zamknutý' : 'Voľné'}</div>
                    <div className="text-xs px-2 py-0.5 rounded border">
                      Kapacita: {s.capacity ?? 1} • Rez: {s.bookedCount ?? 0}
                    </div>
                    <div className="ml-auto flex gap-2">
                      <button className="px-2 py-1 rounded border" onClick={() => toggleSlotLock(s, !s.locked)} disabled={loading}>
                        {s.locked ? 'Odomknúť' : 'Zamknúť'}
                      </button>
                      <input
                        type="number"
                        min={1}
                        defaultValue={s.capacity ?? 1}
                        className="w-20 border rounded px-2 py-1"
                        onBlur={e => changeCapacity(s, Math.max(1, Number(e.target.value) || 1))}
                      />
                      <button className="px-2 py-1 rounded border" onClick={() => deleteSlot(s)} disabled={loading}>
                        Vymazať
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
