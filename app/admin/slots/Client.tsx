'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean; capacity?: number };

export default function AdminSlotsClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [cap,  setCap ] = useState(1);

  async function fetchSlots() {
    const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
    const j = await res.json();
    setSlots(Array.isArray(j?.slots) ? j.slots : []);
  }

  useEffect(() => {
    let m = true;
    (async () => { try { await fetchSlots(); } finally { if (m) setLoading(false); } })();
    return () => { m = false; };
  }, []);

  const refTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleRefetch(ms = 300) {
    if (refTimer.current) clearTimeout(refTimer.current);
    refTimer.current = setTimeout(async () => {
      try { await fetchSlots(); } finally { refTimer.current = null; }
    }, ms);
  }
  function flashSaved() { setSaved(true); setTimeout(()=>setSaved(false), 700); }

  function upsertLocal(s: Slot) {
    setSlots(curr => {
      const i = curr.findIndex(x => x.id === s.id);
      if (i >= 0) { const next = curr.slice(); next[i] = { ...curr[i], ...s }; return next; }
      return curr.concat(s);
    });
  }
  function patchLocal(id: string, p: Partial<Slot>) {
    setSlots(curr => {
      const i = curr.findIndex(x => x.id === id);
      if (i < 0) return curr;
      const next = curr.slice(); next[i] = { ...curr[i], ...p }; return next;
    });
  }
  function removeLocal(id: string) { setSlots(curr => curr.filter(s => s.id !== id)); }

  async function addOne() {
    if (!date || !time) return alert('Zadaj dátum aj čas.');
    const safeCap = Math.max(1, Number.isFinite(+cap) ? +cap : 1);

    const temp: Slot = { id: `${date}_${time.replace(':','')}`, date, time, locked: false, booked: false, capacity: safeCap };
    upsertLocal(temp);
    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time, capacity: safeCap }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'POST failed');
      scheduleRefetch();
      setTime('');
      flashSaved();
    } catch (e: any) {
      alert(e?.message || 'Chyba pri pridávaní');
      scheduleRefetch(0);
    } finally {
      setBusy(false);
    }
  }

  async function toggleLock(s: Slot) {
    patchLocal(s.id, { locked: !s.locked });
    try {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: s.locked ? 'unlock' : 'lock' }),
      });
      scheduleRefetch();
      flashSaved();
    } catch { scheduleRefetch(0); }
  }

  async function changeCap(s: Slot, value: number) {
    const safe = Math.max(1, Number.isFinite(+value) ? +value : 1);
    patchLocal(s.id, { capacity: safe });
    try {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: 'capacity', capacity: safe }),
      });
      scheduleRefetch();
      flashSaved();
    } catch { scheduleRefetch(0); }
  }

  async function removeOne(s: Slot) {
    removeLocal(s.id);
    try {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: 'delete' }),
      });
      scheduleRefetch();
      flashSaved();
    } catch { scheduleRefetch(0); }
  }

  // NOVÉ: Obnoviť (hard re-create)
  async function restoreOne(s: Slot) {
    try {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: 'restore' }),
      });
      scheduleRefetch();
      flashSaved();
    } catch {
      scheduleRefetch(0);
    }
  }

  const grouped = useMemo(() => {
    const by: Record<string, Slot[]> = {};
    for (const s of slots) (by[s.date] ||= []).push(s);
    for (const d of Object.keys(by)) by[d].sort((a,b)=> a.time<b.time?-1:1);
    return Object.entries(by).sort((a,b)=> a[0]<b[0]?-1:1);
  }, [slots]);

  if (loading) return <main className="p-6">Načítavam…</main>;

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Správa slotov</h1>
        {saved && <span className="text-green-600 text-sm">Uložené ✓</span>}
      </div>

      <div className="flex gap-2 items-end flex-wrap">
        <label className="block">
          <span className="block text-xs mb-1">Dátum</span>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded px-3 py-2" />
        </label>
        <label className="block">
          <span className="block text-xs mb-1">Čas</span>
          <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="border rounded px-3 py-2" />
        </label>
        <label className="block">
          <span className="block text-xs mb-1">Kapacita</span>
          <input type="number" min={1} value={cap} onChange={e=>setCap(Math.max(1, Number(e.target.value)||1))} className="border rounded px-3 py-2 w-24" />
        </label>
        <button onClick={addOne} disabled={busy} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">Pridať 1</button>
      </div>

      <div className="space-y-4">
        {grouped.map(([day, list]) => (
          <div key={day} className="rounded border">
            <div className="px-3 py-2 text-sm font-semibold bg-gray-50">{day}</div>
            <div className="p-3 space-y-2">
              {list.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="w-16">{s.time}</div>
                  <input
                    type="number"
                    min={1}
                    value={s.capacity ?? 1}
                    onChange={e=>changeCap(s, Number(e.target.value)||1)}
                    className="border rounded px-2 py-1 w-20"
                  />
                  <div className="text-xs opacity-70 w-28">
                    {s.locked ? 'Zamknuté' : 'Voľné'}
                  </div>
                  <button onClick={()=>toggleLock(s)} className="rounded border px-2 py-1">
                    {s.locked ? 'Odomknúť' : 'Zamknúť'}
                  </button>
                  <button onClick={()=>restoreOne(s)} className="rounded border px-2 py-1">
                    Obnoviť
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
    </main>
  );
}
