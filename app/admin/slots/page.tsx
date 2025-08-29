"use client";
import { useEffect, useState } from "react";

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };

export default function AdminSlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadSlots() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/slots", { cache: "no-store" });
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

  function sortByDateTime(a: Slot, b: Slot) {
    const da = `${a.date}T${a.time}`;
    const db = `${b.date}T${b.time}`;
    if (da < db) return -1;
    if (da > db) return 1;
    return 0;
  }

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  async function addSlot() {
    if (!date || !time) return alert("Zadaj dátum aj čas");
    setBusy(true); setError(null);
    try {
      // optimistic UI – pridaj do tabuľky hneď
      const temp: Slot = { id: `tmp_${Date.now()}`, date, time };
      setSlots(prev => [...prev, temp].sort(sortByDateTime));

      const res = await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Pridanie slotu zlyhalo.");

      // nahradíme temp reálnym záznamom zo servera
      setSlots(prev => prev.map(s => (s.id === temp.id ? json.slot : s)).sort(sortByDateTime));
      setDate(""); setTime("");
      flashSaved();
    } catch (e: any) {
      alert(e?.message || "Pridanie slotu zlyhalo.");
      // re-sync so serverom
      await loadSlots();
    } finally {
      setBusy(false);
    }
  }

  async function updateSlot(id: string, action: "lock" | "unlock" | "delete") {
    setBusy(true); setError(null);

    // optimistic UI – okamžite ukáž zmenu
    setSlots(prev => {
      if (action === "delete") return prev.filter(s => s.id !== id);
      return prev.map(s => (s.id !== id ? s : { ...s, locked: action === "lock" ? true : false }));
    });

    try {
      const res = await fetch("/api/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Aktualizácia slotu zlyhala.");
      // pre istotu zosynchronizuj zo serverom
      setSlots((json.slots || []).sort(sortByDateTime));
      flashSaved();
    } catch (e: any) {
      alert(e?.message || "Aktualizácia slotu zlyhala.");
      await loadSlots();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="p-6">Načítavam sloty…</main>;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Správa slotov</h1>
        {saved && <span className="text-sm text-green-600">Uložené ✓</span>}
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-2"
          disabled={busy}
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="border rounded px-3 py-2"
          disabled={busy}
        />
        <button
          onClick={addSlot}
          className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
          disabled={busy}
        >
          Pridať
        </button>
      </div>

      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Dátum</th>
            <th className="border px-2 py-1">Čas</th>
            <th className="border px-2 py-1">Stav</th>
            <th className="border px-2 py-1">Akcie</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.id}>
              <td className="border px-2 py-1">{s.date}</td>
              <td className="border px-2 py-1">{s.time}</td>
              <td className="border px-2 py-1">
                <span className={`inline-block rounded px-2 py-0.5 text-xs mr-1 ${s.booked ? "bg-gray-900 text-white" : "bg-gray-200"}`}>
                  {s.booked ? "Rezervované" : "Voľné"}
                </span>
                {s.locked && (
                  <span className="inline-block rounded px-2 py-0.5 text-xs bg-amber-200 text-amber-900">
                    Zamknuté
                  </span>
                )}
              </td>
              <td className="border px-2 py-1 space-x-1">
                <button
                  onClick={() => updateSlot(s.id, "lock")}
                  className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                  disabled={busy || s.locked}
                  title="Zamknuté sloty nebudú viditeľné na /rezervacia"
                >
                  Zamknúť
                </button>
                <button
                  onClick={() => updateSlot(s.id, "unlock")}
                  className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                  disabled={busy || !s.locked}
                >
                  Odomknúť
                </button>
                <button
                  onClick={() => updateSlot(s.id, "delete")}
                  className="px-2 py-1 border rounded text-red-600 hover:bg-gray-100 disabled:opacity-50"
                  disabled={busy}
                >
                  Vymazať
                </button>
              </td>
            </tr>
          ))}
          {!slots.length && (
            <tr>
              <td colSpan={4} className="border px-2 py-3 text-center text-gray-600">
                Zatiaľ žiadne sloty. Pridaj prvý hore.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
