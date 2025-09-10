'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';

// --- typy
type Slot = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  locked?: boolean;
  booked?: boolean;
  capacity?: number;
  booked_count?: number;
};

// pomocné formátovanie
function fmtDateLabel(d: Date) {
  return d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
}
function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// vygeneruje maticu týždňov pre daný mesiac (42 polí – 6 týždňov)
function buildMonthMatrix(currentMonth: Date) {
  const firstOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Po=0 … Ne=6
  const startDate = new Date(firstOfMonth);
  startDate.setDate(firstOfMonth.getDate() - startOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function AdminSlotsClient() {
  // --- dáta
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // výber dňa (default dnes)
  const [selectedDate, setSelectedDate] = useState<string>(toYMD(new Date()));

  // pridávanie časov
  const [time, setTime] = useState('');
  const [cap, setCap] = useState(1);
  const [batchTimes, setBatchTimes] = useState<string[]>([]);

  // kalendár
  const [calMonth, setCalMonth] = useState<Date>(() => {
    // ak selectedDate je iný mesiac, nastav ten
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // --- fetch
  async function loadSlots() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Nepodarilo sa načítať sloty.');
      setSlots(Array.isArray(json.slots) ? json.slots : []);
    } catch (e: any) {
      setError(e?.message || 'Chyba pri načítaní slotov.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadSlots(); }, []);

  function flashSaved() { setSaved(true); setTimeout(()=>setSaved(false), 800); }

  // --- pomocné
  function sortByDateTime(a: Slot, b: Slot) {
    const da = `${a.date}T${a.time}`;
    const db = `${b.date}T${b.time}`;
    return da < db ? -1 : da > db ? 1 : 0;
  }

  const selectedDaySlots = useMemo(
    () => slots.filter(s => s.date === selectedDate).sort((a,b)=> a.time<b.time?-1:1),
    [slots, selectedDate]
  );

  // --- akcie API
  async function postCreate(date: string, time: string, capacity: number) {
    const res = await fetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time, capacity }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Uloženie zlyhalo.');
    return json as { ok: boolean; created?: Slot[]; id?: string };
  }

  async function patchAction(id: string, action: 'lock'|'unlock'|'delete'|'free'|'capacity', more?: any) {
    const res = await fetch('/api/slots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, ...more }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Operácia zlyhala.');
    return json as { ok: boolean; slots?: Slot[]; slot?: Slot };
  }

  // --- pridávanie 1
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

  // --- hromadne
  function addTimeToBatch() {
    if (!time) return;
    if (!/^\d{2}:\d{2}$/.test(time)) return alert('Čas musí byť vo formáte HH:MM');
    if (!batchTimes.includes(time)) setBatchTimes(prev => [...prev, time].sort());
    setTime('');
  }
  function removeTimeFromBatch(t: string) { setBatchTimes(prev => prev.filter(x => x !== t)); }
  async function submitBatch() {
    if (!selectedDate) return alert('Vyber datum.');
    if (batchTimes.length === 0) return alert('Pridaj aspoň jeden čas.');
    setBusy(true);
    try {
      // urobíme viac POSTov – jednoduché a spoľahlivé
      for (const t of batchTimes) {
        await postCreate(selectedDate, t, Math.max(1, +cap || 1));
      }
      await loadSlots();
      setBatchTimes([]);
      flashSaved();
    } catch (e:any) {
      alert(e?.message || 'Hromadné pridanie zlyhalo.');
    } finally { setBusy(false); }
  }

  // --- úpravy slotu
  async function lock(id: string) {
    setBusy(true);
    try { await patchAction(id, 'lock'); await loadSlots(); flashSaved(); }
    catch(e:any){ alert(e?.message || 'Zamknutie zlyhalo.'); }
    finally{ setBusy(false); }
  }
  async function unlock(id: string) {
    setBusy(true);
    try { await patchAction(id, 'unlock'); await loadSlots(); flashSaved(); }
    catch(e:any){ alert(e?.message || 'Odomknutie zlyhalo.'); }
    finally{ setBusy(false); }
  }
  async function del(id: string) {
    if (!confirm('Vymazať tento slot?')) return;
    setBusy(true);
    try { await patchAction(id, 'delete'); await loadSlots(); flashSaved(); }
    catch(e:any){ alert(e?.message || 'Vymazanie zlyhalo.'); }
    finally{ setBusy(false); }
  }
  async function free(id: string) {
    if (!confirm('Obnoviť (zmazať rezervácie a uvoľniť) tento slot?')) return;
    setBusy(true);
    try { await patchAction(id, 'free'); await loadSlots(); flashSaved(); }
    catch(e:any){ alert(e?.message || 'Obnovenie zlyhalo.'); }
    finally{ setBusy(false); }
  }
  async function changeCap(id: string, v: number) {
    const safe = Math.max(1, Number.isFinite(+v) ? +v : 1);
    setBusy(true);
    try { await patchAction(id, 'capacity', { capacity: safe }); await loadSlots(); flashSaved(); }
    catch(e:any){ alert(e?.message || 'Zmena kapacity zlyhala.'); }
    finally{ setBusy(false); }
  }

  // --- kalendárne odvodeniny
  const days = useMemo(()=> buildMonthMatrix(calMonth), [calMonth]);
  const monthLabel = useMemo(
    () => calMonth.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' }),
    [calMonth]
  );

  // dostupné dni (čisto informačne – admin môže klikať na hocijaký deň)
  const hasSlotsByDay = useMemo(() => {
    const map = new Set(slots.map(s=>s.date));
    return map;
  }, [slots]);

  if (loading) return <main className="p-6">Načítavam…</main>;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Správa slotov</h1>
        {saved && <span className="text-sm text-green-600">Uložené ✓</span>}
      </div>

      {/* KALENDÁR */}
      <section className="rounded-2xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            className="rounded border px-3 py-1"
            onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
          >
            ‹
          </button>
        <div className="font-medium">{monthLabel}</div>
          <button
            className="rounded border px-3 py-1"
            onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs mb-2 opacity-70">
          <div>po</div><div>ut</div><div>st</div><div>št</div><div>pia</div><div>so</div><div>ne</div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const inMonth = d.getMonth() === calMonth.getMonth();
            const id = toYMD(d);
            const isSelected = id === selectedDate;
            const isToday = id === toYMD(new Date());
            const hint = hasSlotsByDay.has(id);

            return (
              <button
                key={i}
                onClick={() => { setSelectedDate(id); }}
                className={[
                  'h-10 rounded border text-sm',
                  inMonth ? 'bg-white' : 'bg-gray-50 opacity-60',
                  isSelected ? 'bg-black text-white border-black' : '',
                  isToday && !isSelected ? 'ring-1 ring-black/50' : '',
                ].join(' ')}
                title={fmtDateLabel(d)}
              >
                <span className="inline-flex items-center justify-center gap-1">
                  {d.getDate()}
                  {hint && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Panel pre vybraný deň */}
      <section className="rounded-2xl border p-4 space-y-3">
        <div className="text-sm opacity-70">Vybraný deň:</div>
        <div className="text-lg font-semibold">{fmtDateLabel(new Date(selectedDate))}</div>

        {/* pridávanie časov */}
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-xs mb-1">Čas</span>
            <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="border rounded px-3 py-2" disabled={busy} />
          </label>
          <label className="block">
            <span className="block text-xs mb-1">Kapacita</span>
            <input type="number" min={1} value={cap} onChange={e=>setCap(Math.max(1, Number(e.target.value)||1))} className="border rounded px-3 py-2 w-24" disabled={busy} />
          </label>
          <button onClick={addOne} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50" disabled={busy || !time}>
            Pridať 1
          </button>
          <button onClick={addTimeToBatch} className="rounded border px-3 py-2 disabled:opacity-50" disabled={busy || !time}>
            Pridať do zoznamu
          </button>
          <button onClick={submitBatch} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50" disabled={busy || batchTimes.length===0}>
            Pridať všetky ({batchTimes.length})
          </button>
        </div>

        {batchTimes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {batchTimes.map(t => (
              <span key={t} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                {t}
                <button onClick={()=>removeTimeFromBatch(t)} className="text-gray-500 hover:text-black">×</button>
              </span>
            ))}
          </div>
        )}

        {/* tabuľka slotov iba pre vybraný deň */}
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1 w-[20%] text-left">Čas</th>
                <th className="border px-2 py-1 w-[20%] text-left">Kapacita</th>
                <th className="border px-2 py-1 w-[20%] text-left">Stav</th>
                <th className="border px-2 py-1 w-[40%] text-right">Akcie</th>
              </tr>
            </thead>
            <tbody>
              {selectedDaySlots.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Žiadne sloty pre tento deň.</td></tr>
              )}

              {selectedDaySlots.map(s => (
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
                      <span className="text-xs opacity-60">
                        ({s.booked_count ?? 0} / {s.capacity ?? 1})
                      </span>
                    </div>
                  </td>

                  <td className="border px-2 py-1">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs mr-1 ${ (s.booked_count??0) > 0 ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>
                      {(s.booked_count??0) > 0 ? 'Rezervované' : 'Voľné'}
                    </span>
                    {s.locked && <span className="inline-block rounded px-2 py-0.5 text-xs bg-amber-200 text-amber-900">Zamknuté</span>}
                  </td>

                  <td className="border px-2 py-1">
                    <div className="flex justify-end gap-1">
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
