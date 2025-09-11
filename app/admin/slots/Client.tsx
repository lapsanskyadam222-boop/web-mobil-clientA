'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Slot = {
  id: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
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

/** týždne iba pre daný mesiac */
function buildMonthWeeks(monthAnchor: Date): Date[][] {
  const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Po=0..Ne=6
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);

  const inMonth = (d: Date) => d.getMonth() === monthAnchor.getMonth();
  const weeks: Date[][] = [];
  let cur = new Date(start);

  while (true) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    if (!week.some(inMonth)) break;
    weeks.push(week);
  }
  return weeks;
}

/** zmeria šírku kalendára, aby sme ňou ohraničili panel */
function useMeasuredWidth<T extends HTMLElement>(): [React.RefObject<T>, number | null] {
  const ref = useRef<T>(null);
  const [w, setW] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (typeof width === 'number') setW(Math.round(width));
    });
    ro.observe(ref.current);
    setW(ref.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
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

  const [calendarRef, calendarWidth] = useMeasuredWidth<HTMLDivElement>();

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
  const flashSaved = () => { setSaved(true); setTimeout(()=>setSaved(false), 900); };

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

  const panelStyle = calendarWidth ? { maxWidth: `${calendarWidth}px` } : undefined;

  return (
    <main className="mx-auto w-full p-4 sm:p-6 space-y-6 overflow-x-hidden min-w-0">
      <div className="flex items-center justify-between min-w-0">
        <h1 className="text-2xl font-semibold">Správa slotov</h1>
        {saved && <span className="text-sm text-green-600">Uložené ✓</span>}
      </div>

      {/* KALENDÁR */}
      <section ref={calendarRef} className="rounded-2xl border p-3 sm:p-4 min-w-0 mx-auto">
        <div className="mb-3 flex items-center justify-between min-w-0">
          <button className="rounded border px-3 py-1"
                  onClick={()=>setCalMonth(m=>new Date(m.getFullYear(), m.getMonth()-1, 1))}>‹</button>
          <div className="font-medium">{monthLabel}</div>
          <button className="rounded border px-3 py-1"
                  onClick={()=>setCalMonth(m=>new Date(m.getFullYear(), m.getMonth()+1, 1))}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}
             className="text-center text-xs opacity-70 min-w-0">
          <div>po</div><div>ut</div><div>st</div><div>št</div><div>pia</div><div>so</div><div>ne</div>
        </div>

        <div className="space-y-2 min-w-0">
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
                    className={[
                      'rounded border text-sm w-full min-h-10',
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

      {/* PANEL – maxWidth = šírka kalendára */}
      <section className="rounded-2xl p-3 sm:p-4 space-y-3 min-w-0 mx-auto w-full" style={panelStyle}>
        <div className="text-sm opacity-70">Vybraný deň:</div>
        <div className="text-lg font-semibold">{fmtDateLabel(new Date(selectedDate))}</div>

        <div className="flex flex-wrap items-end gap-2 min-w-0">
          <label className="block">
            <span className="block text-xs mb-1">Čas</span>
            <input type="time" value={time} onChange={e=>setTime(e.target.value)}
                   className="border rounded px-3 py-2" disabled={busy}/>
          </label>
          <label className="block">
            <span className="block text-xs mb-1">Kapacita</span>
            <input
              type="number"
              min={1}
              value={cap}
              onChange={e=>setCap(Math.max(1, +e.target.value||1))}
              className="border rounded px-1 py-2 w-12 sm:w-16"
              disabled={busy}
            />
          </label>
          <button onClick={addOne}
                  className="rounded bg-black text-white px-3 sm:px-4 py-2 text-xs sm:text-sm disabled:opacity-50"
                  disabled={busy || !time}>
            Pridať 1
          </button>
          <button onClick={addTimeToBatch}
                  className="rounded border px-3 py-2 text-xs sm:text-sm disabled:opacity-50"
                  disabled={busy || !time}>
            Pridať do zoznamu
          </button>
          <button onClick={submitBatch}
                  className="rounded bg-black text-white px-3 sm:px-4 py-2 text-xs sm:text-sm disabled:opacity-50"
                  disabled={busy || batchTimes.length===0}>
            Pridať všetky ({batchTimes.length})
          </button>
        </div>

        {batchTimes.length>0 && (
          <div className="flex flex-wrap gap-2 min-w-0">
            {batchTimes.map(t=>(
              <span key={t} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                {t}
                <button onClick={()=>removeTimeFromBatch(t)} className="text-gray-500 hover:text-black">×</button>
              </span>
            ))}
          </div>
        )}

        {/* KARTY – jediný layout na všetkých šírkach */}
        <div className="space-y-3">
          {selectedSlots.length === 0 && (
            <div className="text-center text-gray-500 py-6 text-sm">Žiadne sloty pre tento deň.</div>
          )}
          {selectedSlots.map(s => (
            <div key={s.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-base">{s.time}</div>
                <div className="flex items-center gap-1">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs ${ (s.booked_count??0) > 0 ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>
                    {(s.booked_count??0) > 0 ? 'Rezervované' : 'Voľné'}
                  </span>
                  {s.locked && <span className="inline-block rounded px-2 py-0.5 text-xs bg-amber-200 text-amber-900">Zamknuté</span>}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs opacity-70 whitespace-nowrap">Kapacita</label>
                <input
                  type="number"
                  min={1}
                  value={s.capacity ?? 1}
                  onChange={e=>changeCap(s.id, Number(e.target.value)||1)}
                  className="border rounded px-1 py-1 w-12"
                  disabled={busy}
                />
                <span className="text-xs opacity-60 ml-auto whitespace-nowrap">
                  ({s.booked_count ?? 0} / {s.capacity ?? 1})
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!s.locked ? (
                  <button onClick={()=>lock(s.id)} disabled={busy}
                          className="px-3 py-1.5 border rounded text-xs">
                    Zamknúť
                  </button>
                ) : (
                  <button onClick={()=>unlock(s.id)} disabled={busy}
                          className="px-3 py-1.5 border rounded text-xs">
                    Odomknúť
                  </button>
                )}
                <button onClick={()=>del(s.id)} disabled={busy}
                        className="px-3 py-1.5 border rounded text-red-600 text-xs">
                  Vymazať
                </button>
                <button onClick={()=>free(s.id)} disabled={busy}
                        className="px-3 py-1.5 rounded bg-black text-white text-xs">
                  Obnoviť
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-red-600">{error}</p>}
      </section>
    </main>
  );
}
