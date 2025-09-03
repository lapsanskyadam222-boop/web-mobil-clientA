'use client';

import { useEffect, useMemo, useState } from 'react';

type Slot = {
  id: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  locked?: boolean;
  booked?: boolean;
  capacity?: number;
  bookedCount?: number;
};

type SlotsPayload = { slots: Slot[]; updatedAt: string };

function sanitizeTime(v: string) {
  // povoľ "930" → "09:30", "9:3" → "09:03", inak len HH:mm
  const only = v.replace(/[^\d]/g, '').slice(0, 4);
  if (only.length === 3) return `${only[0]}${only[1]}:${only[2]}0`;
  if (only.length === 4) return `${only.slice(0, 2)}:${only.slice(2)}`;
  if (/^\d{2}:\d{2}$/.test(v)) return v;
  return v;
}
function isHm(s: string) { return /^\d{2}:\d{2}$/.test(s); }

export default function AdminSlotsClient() {
  const [slots, setSlots]   = useState<Slot[]>([]);
  const [loading, setLoad]  = useState(true);
  const [busy, setBusy]     = useState(false);
  const [saved, setSaved]   = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  // nový slot
  const [date, setDate]     = useState('');
  const [time, setTime]     = useState('');
  const [cap,  setCap]      = useState<number>(1);

  async function refetch() {
    const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
    const j: SlotsPayload = await res.json();
    setSlots(Array.isArray(j?.slots) ? j.slots : []);
  }

  useEffect(() => {
    (async () => {
      try { await refetch(); } finally { setLoad(false); }
    })();
  }, []);

  function flashSaved() { setSaved(true); setTimeout(() => setSaved(false), 900); }

  // zoskupenie podľa dňa
  const grouped = useMemo(() => {
    const by: Record<string, Slot[]> = {};
    for (const s of slots) (by[s.date] ||= []).push(s);
    for (const d of Object.keys(by)) by[d].sort((a,b)=> a.time<b.time?-1:1);
    return Object.entries(by).sort((a,b)=> a[0]<b[0]?-1:1);
  }, [slots]);

  // ---- actions (po každej operácii urobíme tvrdý refetch = stabilita)
  async function addOne() {
    if (!date) return alert('Zadaj dátum.');
    const t = sanitizeTime(time);
    if (!isHm(t)) return alert('Čas musí byť vo formáte HH:MM');
    const safeCap = Math.max(1, Number.isFinite(+cap) ? +cap : 1);

    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time: t, capacity: safeCap }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Pridanie zlyhalo.');
      await refetch();
      setTime('');
      flashSaved();
    } catch (e: any) {
      setErr(e?.message || 'Pridanie zlyhalo.');
    } finally { setBusy(false); }
  }

  async function changeCap(s: Slot, next: number) {
    const safe = Math.max(1, Number.isFinite(+next) ? +next : 1);
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: 'capacity', capacity: safe }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Zmena kapacity zlyhala.');
      await refetch();
      flashSaved();
    } catch (e: any) {
      setErr(e?.message || 'Zmena kapacity zlyhala.');
    } finally { setBusy(false); }
  }

  async function toggleLock(s: Slot) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: s.locked ? 'unlock' : 'lock' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Zamknutie/odomknutie zlyhalo.');
      await refetch();
      flashSaved();
    } catch (e: any) {
      setErr(e?.message || 'Zamknutie/odomknutie zlyhalo.');
    } finally { setBusy(false); }
  }

  async function removeOne(s: Slot) {
    if (!confirm('Vymazať tento čas?')) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, action: 'delete' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Vymazanie zlyhalo.');
      await refetch();
      flashSaved();
    } catch (e: any) {
      setErr(e?.message || 'Vymazanie zlyhalo.');
    } finally { setBusy(false); }
  }

  async function deleteAll() {
    if (!confirm('NAOZAJ vymazať všetky sloty?')) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/slots', { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Hromadné vymazanie zlyhalo.');
      await refetch();
      flashSaved();
    } catch (e: any) {
      setErr(e?.message || 'Hromadné vymazanie zlyhalo.');
    } finally { setBusy(false); }
  }

  if (loading) return <main className="p-6">Načítavam…</main>;

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Správa slotov</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Uložené ✓</span>}
          <button onClick={deleteAll} disabled={busy || !slots.length}
                  className="rounded border border-red-600 text-red-600 px-3 py-1.5 hover:bg-red-50 disabled:opacity-50">
            Vymazať všetky
          </button>
        </div>
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="rounded-2xl border p-4 space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-xs mb-1">Dátum</span>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                   className="border rounded px-3 py-2" disabled={busy} />
          </label>
          <label className="block">
            <span className="block text-xs mb-1">Čas</span>
            <input
              inputMode="numeric" placeholder="hh:mm"
              value={time}
              onChange={e => setTime(sanitizeTime(e.target.value))}
              className="border rounded px-3 py-2"
              disabled={busy}
            />
          </label>
          <label className="block">
            <span className="block text-xs mb-1">Kapacita</span>
            <input type="number" min={1} value={cap}
                   onChange={e=>setCap(Math.max(1, Number(e.target.value)||1))}
                   className="border rounded px-3 py-2 w-24" disabled={busy}/>
          </label>
          <button onClick={addOne}
                  className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
                  disabled={busy || !date || !isHm(sanitizeTime(time))}>
            Pridať 1
          </button>
        </div>
        <p className="text-xs opacity-70">* Víkendy sú povolené. Čas píš ako 09:30, 13:00…</p>
      </div>

      <div className="space-y-4">
        {grouped.map(([d, list]) => (
          <div key={d} className="rounded border">
            <div className="px-3 py-2 text-sm font-semibold bg-gray-50">{d}</div>
            <div className="p-3 space-y-2">
              {list.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="w-16">{s.time}</div>
                  <div className="w-28">
                    <input
                      type="number" min={1} value={s.capacity ?? 1}
                      onChange={e=>changeCap(s, Number(e.target.value)||1)}
                      className="border rounded px-2 py-1 w-24" disabled={busy}
                    />
                  </div>
                  <div className="text-xs opacity-70 w-28">
                    {s.booked ? 'Rezervované' : (s.locked ? 'Zamknuté' : 'Voľné')}
                  </div>
                  <button onClick={()=>toggleLock(s)} className="rounded border px-2 py-1" disabled={busy}>
                    {s.locked ? 'Odomknúť' : 'Zamknúť'}
                  </button>
                  <button onClick={()=>removeOne(s)} className="rounded border px-2 py-1" disabled={busy}>
                    Vymazať
                  </button>
                </div>
              ))}
              {!list.length && <div className="text-sm opacity-70">–</div>}
            </div>
          </div>
        ))}
        {!grouped.length && <p className="text-sm opacity-70">Zatiaľ žiadne sloty.</p>}
      </div>
    </main>
  );
}
