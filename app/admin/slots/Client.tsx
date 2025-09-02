'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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

export default function AdminSlotsClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newCap,  setNewCap]  = useState(1);

  // ---- fetch on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
        const j: SlotsPayload = await res.json();
        if (!mounted) return;
        setSlots(Array.isArray(j?.slots) ? j.slots : []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ---- debounced refresh (jedno refetch po sérii operácií)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleRefresh(ms = 350) {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
        const j: SlotsPayload = await res.json();
        setSlots(Array.isArray(j?.slots) ? j.slots : []);
      } finally {
        refreshTimer.current = null;
      }
    }, ms);
  }

  // ---- helpers (optimistické úpravy)
  function upsertLocal(s: Slot) {
    setSlots(curr => {
      const i = curr.findIndex(x => x.id === s.id);
      if (i >= 0) {
        const next = curr.slice(); next[i] = { ...curr[i], ...s }; return next;
      }
      return curr.concat(s);
    });
  }
  function updateLocal(id: string, patch: Partial<Slot>) {
    setSlots(curr => {
      const i = curr.findIndex(x => x.id === id);
      if (i < 0) return curr;
      const next = curr.slice(); next[i] = { ...curr[i], ...patch }; return next;
    });
  }
  function removeLocal(id: string) {
    setSlots(curr => curr.filter(s => s.id !== id));
  }

  // ---- actions
  async function addOne() {
    if (!newDate || !newTime) return alert('Zadaj dátum a čas.');
    const cap = Math.max(1, Number.isFinite(+newCap) ? +newCap : 1);

    // optimisticky
    const temp: Slot = {
      id: `${newDate}_${newTime.replace(':','')}`,
      date: newDate, time: newTime, locked: false, booked: false, capacity: cap, bookedCount: 0,
    };
    upsertLocal(temp);

    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate, time: newTime, capacity: cap }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'POST failed');
      // server aj tak vracia celý zoznam – ale namiesto okamžitého refetchnutia
      // necháme debounce, aby sa operácie dali naskladať
      scheduleRefresh();
      setNewTime('');
    } catch (e: any) {
      alert(e?.message || 'Chyba pri pridávaní');
      // rollback – stiahne sa pri ďalšom refreshi
      scheduleRefresh(0);
    }
  }

  async function toggleLock(s: Slot) {
    updateLocal(s.id, { locked: !s.locked });
    try {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: s.locked ? 'unlock' : 'lock' }),
      });
      scheduleRefresh();
    } catch {
      scheduleRefresh(0);
    }
  }

  async function changeCap(s: Slot, cap: number) {
    const safe = Math.max(1, Number.isFinite(+cap) ? +cap : 1);
    updateLocal(s.id, { capacity: safe });
    try {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: 'capacity', capacity: safe }),
      });
      scheduleRefresh();
    } catch {
      scheduleRefresh(0);
    }
  }

  async function removeOne(s: Slot) {
    removeLocal(s.id);
    try {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: 'delete' }),
      });
      scheduleRefresh();
    } catch {
      scheduleRefresh(0);
    }
  }

  // ---- UI
  const grouped = useMemo(() => {
    const by: Record<string, Slot[]> = {};
    for (const s of slots) (by[s.date] ||= []).push(s);
    for (const d of Object.keys(by)) by[d].sort((a,b)=> a.time<b.time?-1:1);
    return Object.entries(by).sort((a,b)=> a[0]<b[0]?-1:1);
  }, [slots]);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Správa slotov</h1>

      <div className="mb-4 flex gap-2 items-end flex-wrap">
        <label className="block">
          <span className="block text-xs mb-1">Dátum</span>
          <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}
                 className="border rounded px-3 py-2" />
        </label>
        <label className="block">
          <span className="block text-xs mb-1">Čas</span>
          <input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)}
                 className="border rounded px-3 py-2" />
        </label>
        <label className="block">
          <span className="block text-xs mb-1">Kapacita</span>
          <input type="number" min={1} value={newCap}
                 onChange={e=>setNewCap(Math.max(1, Number(e.target.value)||1))}
                 className="border rounded px-3 py-2 w-24" />
        </label>
        <button onClick={addOne} className="rounded bg-black text-white px-4 py-2">Pridať 1</button>
      </div>

      {loading ? <p>Načítavam…</p> : (
        <div className="space-y-4">
          {grouped.map(([date, list]) => (
            <div key={date} className="rounded border">
              <div className="px-3 py-2 text-sm font-semibold bg-gray-50">{date}</div>
              <div className="p-3 space-y-2">
                {list.map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="w-16">{s.time}</div>
                    <div className="w-28">
                      <input type="number" min={1} value={s.capacity ?? 1}
                        onChange={e=>changeCap(s, Number(e.target.value)||1)}
                        className="border rounded px-2 py-1 w-24" />
                    </div>
                    <div className="text-xs opacity-70 w-24">
                      {s.locked ? 'Zamknutý' : 'Voľné'}
                    </div>
                    <button onClick={()=>toggleLock(s)} className="rounded border px-2 py-1">
                      {s.locked ? 'Odomknúť' : 'Zamknúť'}
                    </button>
                    <button onClick={()=>removeOne(s)} className="rounded border px-2 py-1">
                      Vymazať
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!grouped.length && <p className="text-sm opacity-70">Zatiaľ žiadne sloty.</p>}
        </div>
      )}
    </main>
  );
}
