'use client';

import { useEffect, useMemo, useState } from 'react';

type Slot = {
  id: string;
  date: string;  // YYYY-MM-DD
  time: string;  // HH:MM
  locked?: boolean;
  booked_count?: number;
  capacity?: number;
};

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fmtDateLabel(d: Date) {
  return d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Vráti pole týždňov (každý týždeň = 7 dní), a zahrnie iba tie týždne,
 * ktoré obsahujú aspoň 1 deň z daného mesiaca. */
function buildMonthWeeks(monthAnchor: Date): Date[][] {
  const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Po=0..Ne=6
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);

  const isInMonth = (d: Date) => d.getMonth() === monthAnchor.getMonth();

  const weeks: Date[][] = [];
  let cursor = new Date(start);

  while (true) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    const hasThisMonth = week.some(isInMonth);
    if (!hasThisMonth) break;           // ďalší týždeň už nemá dni z mesiaca → končíme
    weeks.push(week);
  }
  return weeks;
}

export default function AdminSlotsClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(toYMD(new Date()));

  const [time, setTime] = useState('');
  const [cap, setCap] = useState(1);
  const [batchTimes, setBatchTimes] = useState<string[]>([]);

  const [calMonth, setCalMonth] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const monthLabel = useMemo(
    () => calMonth.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' }),
    [calMonth]
  );
  const weeks = useMemo(() => buildMonthWeeks(calMonth), [calMonth]);

  async function loadSlots() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Nepodarilo sa načítať sloty.');
      setSlots(Array.isArray(json.slots) ? json.slots : []);
    } catch (e:any) {
      setError(e?.message || 'Chyba pri načítaní slotov.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadSlots(); }, []);

  function flashSaved(){ setSaved(true); setTimeout(()=>setSaved(false), 900); }

  function sortByDateTime(a: Slot, b: Slot) {
    const da = `${a.date}T${a.time}`, db = `${b.date}T${b.time}`;
    return da < db ? -1 : da > db ? 1 : 0;
  }
  const selectedSlots = useMemo(
    () => slots.filter(s => s.date === selectedDate).sort((a,b)=>a.time<b.time?-1:1),
    [slots, selectedDate]
  );
  const daysWithSlots = useMemo(() => new Set(slots.map(s => s.date)), [slots]);

  async function postCreate(date: string, time: string, capacity: number) {
    const res = await fetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ date, time, capacity }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Uloženie zlyhalo.');
    return json as { created?: Slot[] };
  }
  async function patchAction(id: string, action: 'lock'|'unlock'|'delete'|'free'|'capacity', more?: any) {
    const res = await fetch('/api/slots', {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id, action, ...more }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Operácia zlyhala.');
    return json;
  }

  async function addOne() {
    if (!selectedDate || !time) return alert('Vyber dátum aj čas.');
    setBusy(true);
    try {
      const out = await postCreate(selectedDate, time, Math.max(1, +cap || 1));
      if (out.created?.length) {
        setSlots(prev => [...prev, ...out.created!].sort(sortByDateTime));
      } else {
        await loadSlots();
      }
      setTime('');
      flashSaved();
    } catch (e:any) {
      alert(e?.message || 'Pridanie zlyhalo.');
    } finally { setBusy(false); }
  }
  function addTimeToBatch(){
    if (!time) return;
    if (!/^\d{2}:\d{2}$/.test(time)) return alert('Čas musí byť HH:MM');
    if (!batchTimes.includes(time)) setBatchTimes(prev => [...prev, time].sort());
    setTime('');
  }
  function removeTimeFromBatch(t:string){ setBatchTimes(prev => prev.filter(x=>x!==t)); }
  async function submitBatch(){
    if (batchTimes.length===0) return alert('Pridaj aspoň jeden čas.');
    setBusy(true);
    try{
      for (const t of batchTimes) await postCreate(selectedDate, t, Math.max(1, +cap || 1));
      await loadSlots();
      setBatchTimes([]);
      flashSaved();
    } catch(e:any){
      alert(e?.message || 'Hromadné pridanie zlyhalo.');
    } finally{ setBusy(false); }
  }

  async function lock(id:string){ setBusy(true); try{ await patchAction(id,'lock'); await loadSlots(); flashSaved(); } catch(e:any){ alert(e?.message||'Zamknutie zlyhalo.'); } finally{ setBusy(false);} }
  async function unlock(id:string){ setBusy(true); try{ await patchAction(id,'unlock'); await loadSlots(); flashSaved(); } catch(e:any){ alert(e?.message||'Odomknutie zlyhalo.'); } finally{ setBusy(false);} }
  async function del(id:string){ if(!confirm('Vymazať slot?'))return; setBusy(true); try{ await patchAction(id,'delete'); await loadSlots(); flashSaved(); } catch(e:any){ alert(e?.message||'Vymazanie zlyhalo.'); } finally{ setBusy(false);} }
  async function free(id:string){ if(!confirm('Obnoviť (zmazať rezervácie a uvoľniť)?'))return; setBusy(true); try{ await patchAction(id,'free'); await loadSlots(); flashSaved(); } catch(e:any){ alert(e?.message||'Obnovenie zlyhalo.'); } finally{ setBusy(false);} }
  async function changeCap(id:string, v:number){ setBusy(true); try{ await patchAction(id,'capacity',{ capacity:Math.max(1, +v||1) }); await loadSlots(); flashSaved(); } catch(e:any){ alert(e?.message||'Zmena kapacity zlyhala.'); } finally{ setBusy(false);} }

  if (loading) return <main className="p-6">Načítavam…</main>;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Správa slotov</h1>
        {saved && <span className="text-sm text-green-600">Uložené ✓</span>}
      </div>

      {/* KALENDÁR – iba týždne, ktoré majú aspoň 1 deň z daného mesiaca */}
      <section className="rounded-2xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            className="rounded border px-3 py-1"
            onClick={()=>setCalMonth(m=>new Date(m.getFullYear(), m.getMonth()-1, 1))}
            aria-label="Predošlý mesiac"
          >‹</button>
          <div className="font-medium">{monthLabel}</div>
          <button
            className="rounded border px-3 py-1"
            onClick={()=>setCalMonth(m=>new Date(m.getFullYear(), m.getMonth()+1, 1))}
            aria-label="Ďalší mesiac"
          >›</button>
        </div>

        {/* hlavička dní */}
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}
          className="text-center text-xs opacity-70"
        >
          <div>po</div><div>ut</div><div>st</div><div>št</div><div>pia</div><div>so</div><div>ne</div>
        </div>

        {/* riadky = týždne */}
        <div className="space-y-2">
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
              {week.map((d, di) => {
                const id = toYMD(d);
                const inMonth = d.getMonth() === calMonth.getMonth();
                const isSelected = id === selectedDate;
                const isToday = id === toYMD(new Date());
                const hasAny = daysWithSlots.has(id);
                return (
                  <button
                    key={di}
                    onClick={()=>setSelectedDate(id)}
                    title={fmtDateLabel(d)}
                    style={{ minHeight: 40 }}
                    className={[
                      'rounded border text-sm w-full',
                      inMonth ? 'bg-white' : 'bg-gray-50 opacity-60',
                      isSelected ? 'bg-black text-white border-black' : '',
                      isToday && !isSelected ? 'ring-1 ring-black/50' : '',
                    ].join(' ')}
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      {d.getDate()}
                      {hasAny && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {/* PANEL PRE VYBRANÝ DEŇ (bez vonkajšej šedej linky) */}
      <section className="rounded-2xl p-4 space-y-3">
        <div className="text-sm opacity-70">Vybraný deň:</div>
        <div className="text-lg font-semibold">{fmtDateLabel(new Date(selectedDate))}</div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-xs mb-1">Čas</span>
            <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="border rounded px-3 py-2" disabled={busy}/>
          </label>
          <label className="block">
            <span className="block text-xs mb-1">Kapacita</span>
            <input type="number" min={1} value={cap} onChange={e=>setCap(Math.max(1, +e.target.value||1))} className="border rounded px-3 py-2 w-24" disabled={busy}/>
          </label>
          <button onClick={addOne} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50" disabled={busy || !time}>Pridať 1</button>
          <button onClick={addTimeToBatch} className="rounded border px-3 py-2 disabled:opacity-50" disabled={busy || !time}>Pridať do zoznamu</button>
          <button onClick={submitBatch} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50" disabled={busy || batchTimes.length===0}>Pridať všetky ({batchTimes.length})</button>
        </div>

        {batchTimes.length>0 && (
          <div className="flex flex-wrap gap-2">
            {batchTimes.map(t=>(
              <span key={t} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                {t}
                <button onClick={()=>removeTimeFromBatch(t)} className="text-gray-500 hover:text-black">×</button>
              </span>
            ))}
          </div>
        )}

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1 w-[20%] text-left">Čas</th>
                <th className="border px-2 py-1 w-[22%] text-left">Kapacita</th>
                <th className="border px-2 py-1 w-[18%] text-left">Stav</th>
                <th className="border px-2 py-1 w-[40%] text-right">Akcie</th>
              </tr>
            </thead>
            <tbody>
              {selectedSlots.length===0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Žiadne sloty pre tento deň.</td></tr>
              )}

              {selectedSlots.map(s=>(
                <tr key={s.id}>
                  <td className="border px-2 py-1">{s.time}</td>
                  <td className="border px-2 py-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={s.capacity ?? 1}
                        onChange={e=>changeCap(s.id, Number(e.target.value)||1)}
                        className="border rounded px-2 py-1 w-20"
                        disabled={busy}
                      />
                      <span className="text-xs opacity-60 whitespace-nowrap">
                        ({s.booked_count ?? 0} / {s.capacity ?? 1})
                      </span>
                    </div>
                  </td>
                  <td className="border px-2 py-1">
                    <div className="flex items-center gap-1">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${ (s.booked_count??0) > 0 ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>
                        {(s.booked_count??0) > 0 ? 'Rezervované' : 'Voľné'}
                      </span>
                      {s.locked && <span className="inline-block rounded px-2 py-0.5 text-xs bg-amber-200 text-amber-900">Zamknuté</span>}
                    </div>
                  </td>
                  <td className="border px-2 py-1">
                    <div className="flex justify-end gap-1 whitespace-nowrap">
                      {!s.locked ? (
                        <button onClick={()=>lock(s.id)} disabled={busy} className="px-2 py-1 border rounded hover:bg-gray-100">Zamknúť</button>
                      ) : (
                        <button onClick={()=>unlock(s.id)} disabled={busy} className="px-2 py-1 border rounded hover:bg-gray-100">Odomknúť</button>
                      )}
                      <button onClick={()=>del(s.id)} disabled={busy} className="px-2 py-1 border rounded text-red-600 hover:bg-gray-100">Vymazať</button>
                      <button onClick={()=>free(s.id)} disabled={busy} className="px-2 py-1 rounded bg-black text-white hover:brightness-110">Obnoviť</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
