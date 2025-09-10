'use client';

import { useEffect, useMemo, useRef, useState, Fragment } from 'react';

type Slot = {
  id: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  locked?: boolean;
  capacity?: number;
  booked_count?: number;
};

export default function AdminSlotsClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form – single + batch
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [cap,  setCap ] = useState(1);
  const [batchTimes, setBatchTimes] = useState<string[]>([]);

  // --- fetch (no-store + cache-buster)
  async function fetchSlots() {
    setError(null);
    const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || 'Nepodarilo sa načítať sloty.');
    setSlots(Array.isArray(j?.slots) ? j.slots : []);
  }

  useEffect(() => {
    let m = true;
    (async () => {
      try { await fetchSlots(); }
      catch (e: any) { if (m) setError(e?.message || 'Chyba pri načítaní slotov.'); }
      finally { if (m) setLoading(false); }
    })();
    return () => { m = false; };
  }, []);

  // --- debounce refetch
  const refTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleRefetch(ms = 300) {
    if (refTimer.current) clearTimeout(refTimer.current);
    refTimer.current = setTimeout(async () => {
      try { await fetchSlots(); } finally { refTimer.current = null; }
    }, ms);
  }

  function flashSaved() { setSaved(true); setTimeout(()=>setSaved(false), 800); }

  // --- optimistic helpers
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

  // --- actions: single add
  async function addOne() {
    if (!date || !time) return alert('Zadaj dátum aj čas.');
    const safeCap = Math.max(1, Number.isFinite(+cap) ? +cap : 1);
    const temp: Slot = { id: `${date}_${time.replace(':','')}`, date, time, locked: false, capacity: safeCap, booked_count: 0 };
    upsertLocal(temp);

    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time, capacity: safeCap }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Pridanie slotu zlyhalo.');
      setTime('');
      flashSaved();
      scheduleRefetch();
    } catch (e: any) {
      alert(e?.message || 'Chyba pri pridávaní');
      scheduleRefetch(0);
    } finally {
      setBusy(false);
    }
  }

  // --- actions: batch add (klient posiela N× single POST – netreba meniť API)
  function addTimeToBatch() {
    if (!time) return;
    if (!/^\d{2}:\d{2}$/.test(time)) return alert('Čas musí byť vo formáte HH:MM');
    if (batchTimes.includes(time)) return;
    setBatchTimes(prev => [...prev, time].sort());
    setTime('');
  }
  function removeTimeFromBatch(t: string) {
    setBatchTimes(prev => prev.filter(x => x !== t));
  }
  async function submitBatch() {
    if (!date) return alert('Vyber dátum.');
    if (batchTimes.length === 0) return alert('Pridaj aspoň jeden čas.');
    const safeCap = Math.max(1, Number.isFinite(+cap) ? +cap : 1);

    setBusy(true);
    try {
      // sekvenčne – menšia šanca na kolíziu/limit
      for (const t of batchTimes) {
        const id = `${date}_${t.replace(':','')}`;
        upsertLocal({ id, date, time: t, locked: false, capacity: safeCap, booked_count: 0 });
        const res = await fetch('/api/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, time: t, capacity: safeCap }),
        });
        if (!res.ok) {
          const j = await res.json().catch(()=> ({}));
          throw new Error(j?.error || `Chyba pri pridávaní ${t}`);
        }
      }
      setBatchTimes([]);
      flashSaved();
      scheduleRefetch(150);
    } catch (e: any) {
      alert(e?.message || 'Hromadné pridanie zlyhalo.');
      scheduleRefetch(0);
    } finally {
      setBusy(false);
    }
  }

  // --- actions: lock / unlock / delete / restore / capacity
  async function toggleLock(s: Slot) {
    patchLocal(s.id, { locked: !s.locked });
    try {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: s.locked ? 'unlock' : 'lock' }),
      });
      flashSaved();
      scheduleRefetch();
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
      flashSaved();
      scheduleRefetch();
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
      flashSaved();
      scheduleRefetch();
    } catch { scheduleRefetch(0); }
  }

  async function restoreOne(s: Slot) {
    // vizuálne vrátime do Voľné (booked_count=0)
    patchLocal(s.id, { locked: false, booked_count: 0 });
    try {
      await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: 'restore' }),
      });
      flashSaved();
      scheduleRefetch();
    } catch {
      scheduleRefetch(0);
    }
  }

  // group by day
  const grouped = useMemo(() => {
    const by: Record<string, Slot[]> = {};
    for (const s of slots) (by[s.date] ||= []).push(s);
    for (const d of Object.keys(by)) by[d].sort((a,b)=> a.time<b.time?-1:1);
    return Object.entries(by).sort((a,b)=> a[0]<b[0]?-1:1);
  }, [slots]);

  if (loading) return <main className="p-6">Načítavam…</main>;

  function renderStatus(s: Slot) {
    const booked = s.booked_count ?? 0;
    const cap = s.capacity ?? 1;
    const isFull = booked >= cap;
    return (
      <div className="flex items-center gap-1">
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs ${
            isFull ? 'bg-gray-900 text-white' : 'bg-gray-200'
          }`}
          title={`Rezervované ${booked}/${cap}`}
        >
          {isFull ? 'Rezervované' : 'Voľné'}
        </span>
        {s.locked && (
          <span className="inline-block rounded px-2 py-0.5 text-xs bg-amber-200 text-amber-900">
            Zamknuté
          </span>
        )}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Správa slotov</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Uložené ✓</span>}
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {/* Form – single + batch */}
      <div className="space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block">
            <span className="block text-xs mb-1">Dátum</span>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded px-3 py-2" disabled={busy} />
          </label>
          <label className="block">
            <span className="block text-xs mb-1">Čas</span>
            <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="border rounded px-3 py-2" disabled={busy} />
          </label>
          <label className="block">
            <span className="block text-xs mb-1">Kapacita</span>
            <input type="number" min={1} value={cap} onChange={e=>setCap(Math.max(1, Number(e.target.value)||1))} className="border rounded px-3 py-2 w-24" disabled={busy} />
          </label>

          <button onClick={addOne} className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50" disabled={busy}>
            Pridať 1
          </button>

          <button onClick={addTimeToBatch} className="rounded border px-3 py-2 hover:bg-gray-50 disabled:opacity-50" disabled={busy || !time}>
            Pridať do zoznamu
          </button>

          <button onClick={submitBatch} className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50" disabled={busy || !date || batchTimes.length === 0}>
            Pridať všetky ({batchTimes.length})
          </button>
        </div>

        {batchTimes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {batchTimes.map(t => (
              <span key={t} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                {t}
                <button onClick={() => removeTimeFromBatch(t)} className="text-gray-500 hover:text-black" title="Odstrániť čas">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabuľka */}
      <div className="w-full border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 w-[35%] text-left">Dátum</th>
              <th className="border px-2 py-1 w-[15%] text-left">Čas</th>
              <th className="border px-2 py-1 w-[20%] text-left">Kapacita</th>
              <th className="border px-2 py-1 w-[15%] text-left">Stav</th>
              <th className="border px-2 py-1 w-[25%] text-left">Akcie</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([day, daySlots]) => (
              <Fragment key={day}>
                <tr>
                  <td colSpan={5} className="border-t bg-gray-50 px-3 py-2 font-semibold">
                    {new Date(day).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
                {daySlots.map((s) => (
                  <tr key={s.id}>
                    <td className="border px-2 py-1">&nbsp;</td>
                    <td className="border px-2 py-1">{s.time}</td>
                    <td className="border px-2 py-1">
                      <input
                        type="number"
                        min={1}
                        value={s.capacity ?? 1}
                        onChange={e => changeCap(s, Number(e.target.value) || 1)}
                        className="border rounded px-2 py-1 w-20"
                      />
                      <span className="ml-2 text-xs opacity-70">({s.booked_count ?? 0} / {s.capacity ?? 1})</span>
                    </td>
                    <td className="border px-2 py-1">{renderStatus(s)}</td>
                    <td className="border px-2 py-1 space-x-1">
                      <button
                        onClick={() => toggleLock(s)}
                        className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                        disabled={busy}
                      >
                        {s.locked ? 'Odomknúť' : 'Zamknúť'}
                      </button>

                      <button
                        onClick={() => removeOne(s)}
                        className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                        disabled={busy}
                      >
                        Vymazať
                      </button>

                      {/* Obnoviť – presunuté ZA Vymazať + čierne tlačidlo s bielym textom */}
                      <button
                        onClick={() => restoreOne(s)}
                        className="px-2 py-1 rounded bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                        disabled={busy}
                        title="Zmaže súvisiace rezervácie a nastaví slot opäť ako voľný"
                      >
                        Obnoviť
                      </button>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {!grouped.length && (
              <tr>
                <td colSpan={5} className="border px-2 py-3 text-center text-gray-600">
                  Zatiaľ žiadne sloty. Pridaj prvý hore (víkendy sú povolené).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
