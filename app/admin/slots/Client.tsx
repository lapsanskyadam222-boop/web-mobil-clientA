"use client";

import { useEffect, useMemo, useState, Fragment } from "react";

type Slot = {
  id: string;
  date: string;
  time: string;
  locked?: boolean;
  booked?: boolean;         // len na zobrazenie
  capacity?: number;        // pre input
  booked_count?: number;    // (x / y)
};

export default function AdminSlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [batchTimes, setBatchTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function sortByDateTime(a: Slot, b: Slot) {
    const da = `${a.date}T${a.time}`;
    const db = `${b.date}T${b.time}`;
    return da < db ? -1 : da > db ? 1 : 0;
  }

  async function loadSlots() {
    setError(null);
    try {
      const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Nepodarilo sa načítať sloty.");
      setSlots((json.slots || []).sort(sortByDateTime));
    } catch (e: any) {
      setError(e?.message || "Chyba pri načítaní slotov.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSlots(); }, []);

  function flashSaved() { setSaved(true); setTimeout(() => setSaved(false), 900); }

  // --- pridanie 1
  async function addSingle() {
    if (!date || !time) return alert("Zadaj dátum aj čas");
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Pridanie slotu zlyhalo.");
      const created: Slot[] = json.created || [];
      if (created.length) setSlots(prev => [...prev, ...created].sort(sortByDateTime));
      setTime("");
      flashSaved();
    } catch (e: any) {
      alert(e?.message || "Pridanie slotu zlyhalo.");
    } finally { setBusy(false); }
  }

  // --- hromadné pridanie
  function addTimeToBatch() {
    if (!time) return;
    if (!/^\d{2}:\d{2}$/.test(time)) return alert("Čas musí byť vo formáte HH:MM");
    if (batchTimes.includes(time)) return;
    setBatchTimes(prev => [...prev, time].sort());
    setTime("");
  }
  function removeTimeFromBatch(t: string) {
    setBatchTimes(prev => prev.filter(x => x !== t));
  }
  async function submitBatch() {
    if (!date) return alert("Vyber dátum.");
    if (batchTimes.length === 0) return alert("Pridaj aspoň jeden čas.");
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, times: batchTimes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Hromadné pridanie zlyhalo.");
      const created: Slot[] = json.created || [];
      if (created.length) setSlots(prev => [...prev, ...created].sort(sortByDateTime));
      setBatchTimes([]);
      flashSaved();
    } catch (e: any) {
      alert(e?.message || "Hromadné pridanie zlyhalo.");
    } finally { setBusy(false); }
  }

  // --- zmena kapacity
  async function changeCapacity(s: Slot, next: number) {
    const cap = Math.max(1, Number.isFinite(+next) ? +next : 1);
    // optimisticky:
    setSlots(prev => prev.map(x => x.id === s.id ? { ...x, capacity: cap } : x));
    try {
      const res = await fetch("/api/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, action: "capacity", capacity: cap }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Zmena kapacity zlyhala.");
      // pre istotu zosynchronizuj zo servera, ak prišla kolekcia
      if (Array.isArray(json.slots)) setSlots(json.slots.sort(sortByDateTime));
      flashSaved();
    } catch {
      // rollback načítaním
      loadSlots();
    }
  }

  // --- update / delete / free
  async function updateSlot(id: string, action: "lock" | "unlock" | "delete" | "free") {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Aktualizácia slotu zlyhala.");

      // API môže vrátiť { slots } alebo { slot }
      if (Array.isArray(json.slots)) {
        setSlots(json.slots.sort(sortByDateTime));
      } else if (json.slot && json.slot.id) {
        setSlots(prev => {
          const i = prev.findIndex(x => x.id === json.slot.id);
          if (i < 0) return prev;
          const next = prev.slice();
          next[i] = { ...prev[i], ...json.slot };
          return next.sort(sortByDateTime);
        });
      } else {
        // fallback: refetch
        await loadSlots();
      }

      flashSaved();
    } catch (e: any) {
      alert(e?.message || "Aktualizácia slotu zlyhala.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    if (!confirm("Naozaj chceš VYMAZAŤ VŠETKY sloty? Táto akcia je nezvratná.")) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/slots", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Vymazanie všetkých slotov zlyhalo.");
      setSlots([]);
      flashSaved();
    } catch (e: any) {
      alert(e?.message || "Vymazanie všetkých slotov zlyhalo.");
    } finally { setBusy(false); }
  }

  // zoskupenie podľa dňa
  const grouped = useMemo(() => {
    const byDay = new Map<string, Slot[]>();
    for (const s of slots) {
      if (!byDay.has(s.date)) byDay.set(s.date, []);
      byDay.get(s.date)!.push(s);
    }
    return Array.from(byDay.entries()).sort(([d1], [d2]) => (d1 < d2 ? -1 : d1 > d2 ? 1 : 0));
  }, [slots]);

  if (loading) return <main className="p-6">Načítavam sloty…</main>;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-5">
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

      {error && <p className="text-red-600">{error}</p>}

      {/* pridávanie slotov */}
      <div className="space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-3 py-2" disabled={busy} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="border rounded px-3 py-2" disabled={busy} />
          <button onClick={addSingle} className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50" disabled={busy}>
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

      <div className="w-full border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 w-[28%] text-left">Dátum</th>
              <th className="border px-2 py-1 w-[14%] text-left">Čas</th>
              <th className="border px-2 py-1 w-[22%] text-left">Kapacita</th>
              <th className="border px-2 py-1 w-[16%] text-left">Stav</th>
              <th className="border px-2 py-1 w-[20%] text-left">Akcie</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([day, daySlots]) => (
              <Fragment key={day}>
                <tr>
                  <td colSpan={5} className="border-t bg-gray-50 px-3 py-2 font-semibold">
                    {new Date(day).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" })}
                  </td>
                </tr>
                {daySlots.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0)).map((s) => (
                  <tr key={s.id}>
                    <td className="border px-2 py-1">&nbsp;</td>
                    <td className="border px-2 py-1">{s.time}</td>

                    {/* Kapacita (input + zobrazenie počítadla) */}
                    <td className="border px-2 py-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={s.capacity ?? 1}
                          onChange={e => changeCapacity(s, Number(e.target.value) || 1)}
                          className="w-20 border rounded px-2 py-1"
                          disabled={busy}
                        />
                        <span className="text-xs opacity-70">
                          ({s.booked_count ?? 0} / {s.capacity ?? 1})
                        </span>
                      </div>
                    </td>

                    {/* Stav */}
                    <td className="border px-2 py-1">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs mr-1 ${s.booked ? "bg-gray-900 text-white" : "bg-gray-200"}`}>
                        {s.booked ? "Rezervované" : "Voľné"}
                      </span>
                      {s.locked && <span className="inline-block rounded px-2 py-0.5 text-xs bg-amber-200 text-amber-900">Zamknuté</span>}
                    </td>

                    {/* Akcie – v jednom riadku, zarovnané doprava */}
                    <td className="border px-2 py-1">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => updateSlot(s.id, s.locked ? "unlock" : "lock")}
                          className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                          disabled={busy}
                          title={s.locked ? "Odomknúť" : "Zamknúť"}
                        >
                          {s.locked ? "Odomknúť" : "Zamknúť"}
                        </button>

                        <button
                          onClick={() => updateSlot(s.id, "delete")}
                          className="px-2 py-1 border rounded hover:bg-gray-100 text-red-600 disabled:opacity-50"
                          disabled={busy}
                          title="Vymazať"
                        >
                          Vymazať
                        </button>

                        <button
                          onClick={() => updateSlot(s.id, "free")}
                          className="px-2 py-1 rounded bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                          disabled={busy}
                          title="Obnoviť (vyčistí rezervácie a odomkne)"
                        >
                          Obnoviť
                        </button>
                      </div>
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
