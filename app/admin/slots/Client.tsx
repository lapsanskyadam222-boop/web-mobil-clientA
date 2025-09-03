// app/admin/slots/Client.tsx
'use client';
import { useEffect, useMemo, useRef, useState, Fragment } from 'react';

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean; capacity?: number };
type SlotsPayload = { slots: Slot[]; updatedAt: string };

export default function AdminSlotsClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [cap,  setCap ] = useState<number>(1);

  async function fetchFresh() {
    const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
    const j: SlotsPayload = await res.json();
    setSlots(Array.isArray(j?.slots) ? j.slots : []);
  }

  useEffect(() => {
    (async () => { try { await fetchFresh(); } finally { setLoading(false); } })();
  }, []);

  // debounced refetch po operácii – stiahne reálny stav zo servera
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function refetchSoon(ms = 300) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { fetchFresh().finally(() => (timer.current = null)); }, ms);
  }

  async function addOne() {
    if (!date || !time) return alert('Zadaj dátum aj čas.');
    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time, capacity: Math.max(1, Number(cap) || 1) }),
      });
      if (!res.ok) alert((await res.json())?.error || 'Pridanie zlyhalo');
      refetchSoon(0); // okamžite stiahni reálny stav
      setTime('');
    } finally { setBusy(false); }
  }

  async function patch(body: any) {
    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) alert((await res.json())?.error || 'Operácia zlyhala');
      refetchSoon(0);
    } finally { setBusy(false); }
  }

  async function wipeAll() {
    if (!confirm('Naozaj vymazať VŠETKO?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/slots', { method: 'DELETE' });
      if (!res.ok) alert((await res.json())?.error || 'Vymazanie zlyhalo');
      refetchSoon(0);
    } finally { setBusy(false); }
  }

  const grouped = useMemo(() => {
    const by = new Map<string, Slot[]>();
    for (const s of slots) { if (!by.has(s.date)) by.set(s.date, []); by.get(s.date)!.push(s); }
    for (const k of by.keys()) by.get(k)!.sort((a,b)=> a.time<b.time?-1:1);
    return Array.from(by.entries()).sort((a,b)=> a[0]<b[0]?-1:1);
  }, [slots]);

  if (loading) return <main className="p-6">Načítavam…</main>;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Správa slotov</h1>
        <button onClick={wipeAll} className="rounded border border-red-600 text-red-600 px-3 py-1.5 hover:bg-red-50" disabled={busy || slots.length===0}>
          Vymazať všetky
        </button>
      </div>

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
            <input type="number" min={1} value={cap} onChange={e=>setCap(Math.max(1, Number(e.target.value)||1))} className="border rounded px-3 py-2 w-24" disabled={busy}/>
          </label>
          <button onClick={addOne} className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50" disabled={busy}>
            Pridať 1
          </button>
        </div>
      </div>

      <div className="w-full border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 w-[35%] text-left">Dátum</th>
              <th className="border px-2 py-1 w-[20%] text-left">Čas</th>
              <th className="border px-2 py-1 w-[20%] text-left">Stav</th>
              <th className="border px-2 py-1 w-[25%] text-left">Akcie</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([day, list]) => (
              <Fragment key={day}>
                <tr><td colSpan={4} className="border-t bg-gray-50 px-3 py-2 font-semibold">
                  {new Date(day).toLocaleDateString('sk-SK',{day:'numeric',month:'numeric',year:'numeric'})}
                </td></tr>
                {list.map(s=>(
                  <tr key={s.id}>
                    <td className="border px-2 py-1">&nbsp;</td>
                    <td className="border px-2 py-1">{s.time}</td>
                    <td className="border px-2 py-1">
                      {s.locked ? 'Zamknuté' : 'Voľné'} • Kapacita {s.capacity ?? 1}
                    </td>
                    <td className="border px-2 py-1 space-x-1">
                      <button onClick={()=>patch({ id: s.id, action: s.locked?'unlock':'lock' })} className="px-2 py-1 border rounded hover:bg-gray-100" disabled={busy}>
                        {s.locked ? 'Odomknúť' : 'Zamknúť'}
                      </button>
                      <button onClick={()=>patch({ id: s.id, action: 'delete' })} className="px-2 py-1 border rounded text-red-600 hover:bg-gray-100" disabled={busy}>
                        Vymazať
                      </button>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {!grouped.length && (
              <tr>
                <td colSpan={4} className="border px-2 py-3 text-center text-gray-600">
                  Zatiaľ žiadne sloty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
