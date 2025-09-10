'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';

type Slot = {
  id: string;
  date: string;      // YYYY-MM-DD
  time: string;      // HH:MM
  capacity: number;
  locked: boolean;
  booked_count: number;
};

/* utils */
function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function parseYmd(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function sameYmd(a: string, b: string) {
  return a === b;
}
function monthMatrix(anchor: Date) {
  // vygeneruje 6 týždňov (7 dní) okolo anchor month
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  // pondelok=1…nedeľa=0 v JS – chceme pondelok ako prvý deň týždňa
  const dow = (first.getDay() + 6) % 7; // 0..6, 0 = pondelok
  start.setDate(first.getDate() - dow);

  const weeks: Date[][] = [];
  let cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

export default function AdminSlotsClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // dátumová hlavička (kalendár)
  const todayStr = ymd(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [monthAnchor, setMonthAnchor] = useState<Date>(parseYmd(todayStr));

  // „pridávanie“
  const [time, setTime] = useState('');
  const [cap, setCap] = useState(1);
  const [batchTimes, setBatchTimes] = useState<string[]>([]);

  async function fetchSlots() {
    try {
      const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Načítanie slotov zlyhalo.');
      const list: Slot[] = Array.isArray(j?.slots) ? j.slots : [];
      setSlots(list);
    } catch (e: any) {
      setError(e?.message || 'Načítanie slotov zlyhalo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchSlots();
  }, []);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 900);
  }

  /* filtrovaný zoznam – len pre zvolený deň */
  const daySlots = useMemo(() => {
    return slots
      .filter((s) => sameYmd(s.date, selectedDate))
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  }, [slots, selectedDate]);

  /* metadáta do kalendára – ktoré dni majú aspoň 1 slot */
  const daysWithSlots = useMemo(() => {
    const set = new Set(slots.map((s) => s.date));
    return set;
  }, [slots]);

  /* --- akcie --- */
  async function addOne() {
    if (!selectedDate || !time) return alert('Zadaj dátum aj čas.');
    const safeCap = Math.max(1, Number.isFinite(+cap) ? +cap : 1);
    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, time, capacity: safeCap }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Pridanie zlyhalo.');
      setTime('');
      await fetchSlots();
      flashSaved();
    } catch (e: any) {
      alert(e?.message || 'Pridanie zlyhalo.');
    } finally {
      setBusy(false);
    }
  }

  function addTimeToBatch() {
    if (!time) return;
    if (!/^\d{2}:\d{2}$/.test(time)) return alert('Čas musí byť vo formáte HH:MM');
    if (batchTimes.includes(time)) return;
    setBatchTimes((prev) => [...prev, time].sort());
    setTime('');
  }
  function removeTimeFromBatch(t: string) {
    setBatchTimes((prev) => prev.filter((x) => x !== t));
  }
  async function addBatch() {
    if (!selectedDate) return alert('Najprv vyber deň.');
    if (batchTimes.length === 0) return alert('Pridaj aspoň jeden čas.');
    const safeCap = Math.max(1, Number.isFinite(+cap) ? +cap : 1);
    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, times: batchTimes, capacity: safeCap }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Hromadné pridanie zlyhalo.');
      setBatchTimes([]);
      await fetchSlots();
      flashSaved();
    } catch (e: any) {
      alert(e?.message || 'Hromadné pridanie zlyhalo.');
    } finally {
      setBusy(false);
    }
  }

  async function updateSlot(id: string, action: 'lock' | 'unlock' | 'delete' | 'free') {
    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Akcia zlyhala.');
      // pre istotu refetch (keďže FREE vracia aj nový stav)
      await fetchSlots();
      flashSaved();
    } catch (e: any) {
      alert(e?.message || 'Akcia zlyhala.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    if (!confirm('Naozaj chceš VYMAZAŤ VŠETKY sloty?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/slots', { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Vymazanie zlyhalo.');
      setSlots([]);
      flashSaved();
    } catch (e: any) {
      alert(e?.message || 'Vymazanie zlyhalo.');
    } finally {
      setBusy(false);
    }
  }

  /* render */
  if (loading) return <main className="p-6">Načítavam…</main>;

  const weeks = monthMatrix(monthAnchor);
  const header = monthAnchor.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Správa slotov</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Uložené ✓</span>}
          <button
            onClick={deleteAll}
            className="rounded border border-red-600 text-red-600 px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
            disabled={busy || slots.length === 0}
            title="Vymaže všetky sloty"
          >
            Vymazať všetky
          </button>
        </div>
      </div>

      {/* KALENDÁR */}
      <section className="rounded-2xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() =>
              setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
            }
            className="rounded border px-2 py-1 hover:bg-gray-50"
            disabled={busy}
          >
            ‹
          </button>
        <div className="font-semibold select-none">{header}</div>
          <button
            onClick={() =>
              setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
            }
            className="rounded border px-2 py-1 hover:bg-gray-50"
            disabled={busy}
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 text-xs font-medium text-gray-600 mb-1">
          <div className="text-center py-1">po</div>
          <div className="text-center py-1">ut</div>
          <div className="text-center py-1">st</div>
          <div className="text-center py-1">št</div>
          <div className="text-center py-1">pia</div>
          <div className="text-center py-1">so</div>
          <div className="text-center py-1">ne</div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weeks.map((row, i) => (
            <Fragment key={i}>
              {row.map((d) => {
                const iso = ymd(d);
                const inMonth = d.getMonth() === monthAnchor.getMonth();
                const isSelected = sameYmd(iso, selectedDate);
                const hasSlots = daysWithSlots.has(iso);

                return (
                  <button
                    key={iso}
                    onClick={() => setSelectedDate(iso)}
                    className={[
                      'h-10 rounded-md border text-sm',
                      inMonth ? '' : 'opacity-40',
                      isSelected ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50',
                      hasSlots ? '' : 'opacity-60',
                    ].join(' ')}
                    title={iso}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </section>

      {/* PRIDÁVANIE DO VYBRANÉHO DŇA */}
      <section className="rounded-2xl border p-4 space-y-3">
        <div className="text-sm text-gray-600">
          Vybraný deň: <span className="font-semibold">{new Date(selectedDate).toLocaleDateString('sk-SK')}</span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-xs mb-1">Čas</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="border rounded px-3 py-2"
              disabled={busy}
            />
          </label>
          <label className="block">
            <span className="block text-xs mb-1">Kapacita</span>
            <input
              type="number"
              min={1}
              value={cap}
              onChange={(e) => setCap(Math.max(1, Number(e.target.value) || 1))}
              className="border rounded px-3 py-2 w-24"
              disabled={busy}
            />
          </label>
          <button
            onClick={addOne}
            className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
            disabled={busy || !selectedDate || !time}
          >
            Pridať 1
          </button>
          <button
            onClick={addTimeToBatch}
            className="rounded border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
            disabled={busy || !time}
          >
            Pridať do zoznamu
          </button>
          <button
            onClick={addBatch}
            className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
            disabled={busy || !selectedDate || batchTimes.length === 0}
            title="Pridá všetky časy v zozname pre vybraný deň"
          >
            Pridať všetky ({batchTimes.length})
          </button>
        </div>

        {batchTimes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {batchTimes.map((t) => (
              <span key={t} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                {t}
                <button onClick={() => removeTimeFromBatch(t)} className="text-gray-500 hover:text-black" title="Odstrániť">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* TABUĽKA SLOTOV – len pre vybraný deň */}
      <section className="w-full border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 w-[20%] text-left">Čas</th>
              <th className="border px-2 py-1 w-[25%] text-left">Kapacita</th>
              <th className="border px-2 py-1 w-[20%] text-left">Stav</th>
              <th className="border px-2 py-1 w-[35%] text-right pr-3">Akcie</th>
            </tr>
          </thead>
          <tbody>
            {daySlots.map((s) => (
              <tr key={s.id}>
                <td className="border px-2 py-1">{s.time}</td>
                <td className="border px-2 py-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      className="border rounded px-2 py-1 w-20"
                      value={s.capacity}
                      onChange={async (e) => {
                        const value = Math.max(1, Number(e.target.value) || 1);
                        setBusy(true);
                        try {
                          const res = await fetch('/api/slots', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: s.id, action: 'capacity', capacity: value }),
                          });
                          const j = await res.json();
                          if (!res.ok) throw new Error(j?.error || 'Zmena kapacity zlyhala.');
                          await fetchSlots();
                          flashSaved();
                        } catch (err: any) {
                          alert(err?.message || 'Zmena kapacity zlyhala.');
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy}
                    />
                    <span className="text-xs opacity-70">
                      ({s.booked_count} / {s.capacity})
                    </span>
                  </div>
                </td>
                <td className="border px-2 py-1">
                  <span
                    className={[
                      'inline-block rounded px-2 py-0.5 text-xs mr-1',
                      s.booked_count > 0 ? 'bg-gray-900 text-white' : 'bg-gray-200',
                    ].join(' ')}
                  >
                    {s.booked_count > 0 ? 'Rezervované' : 'Voľné'}
                  </span>
                  {s.locked && (
                    <span className="inline-block rounded px-2 py-0.5 text-xs bg-amber-200 text-amber-900">
                      Zamknuté
                    </span>
                  )}
                </td>
                <td className="border px-2 py-1">
                  <div className="ml-auto flex justify-end gap-2">
                    {!s.locked ? (
                      <button
                        onClick={() => updateSlot(s.id, 'lock')}
                        className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                        disabled={busy}
                      >
                        Zamknúť
                      </button>
                    ) : (
                      <button
                        onClick={() => updateSlot(s.id, 'unlock')}
                        className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                        disabled={busy}
                      >
                        Odomknúť
                      </button>
                    )}

                    <button
                      onClick={() => updateSlot(s.id, 'delete')}
                      className="px-2 py-1 border rounded text-red-600 hover:bg-gray-100 disabled:opacity-50"
                      disabled={busy}
                    >
                      Vymazať
                    </button>

                    <button
                      onClick={() => updateSlot(s.id, 'free')}
                      className="px-2 py-1 rounded bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                      disabled={busy}
                      title="Zruší všetky rezervácie v slote a nastaví ho na Voľné"
                    >
                      Obnoviť
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!daySlots.length && (
              <tr>
                <td colSpan={4} className="border px-2 py-3 text-center text-gray-600">
                  Žiadne sloty pre zvolený deň. Pridaj čas vyššie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
