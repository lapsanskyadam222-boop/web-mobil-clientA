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

  async function loadSlots() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/slots", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Nepodarilo sa načítať sloty.");
      setSlots(json.slots || []);
    } catch (e: any) {
      setError(e?.message || "Chyba pri načítaní slotov.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSlots(); }, []);

  async function addSlot() {
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
      setDate(""); setTime("");
      await loadSlots();
    } catch (e: any) {
      alert(e?.message || "Pridanie slotu zlyhalo.");
    } finally {
      setBusy(false);
    }
  }

  async function updateSlot(id: string, action: "lock" | "unlock" | "delete") {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Aktualizácia slotu zlyhala.");
      await loadSlots();
    } catch (e: any) {
      alert(e?.message || "Aktualizácia slotu zlyhala.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="p-6">Načítavam sloty…</main>;

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Správa slotov</h1>

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
                {s.booked ? "Rezervované" : s.locked ? "Zamknuté" : "Voľné"}
              </td>
              <td className="border px-2 py-1 space-x-1">
                <button
                  onClick={() => updateSlot(s.id, "lock")}
                  className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                  disabled={busy}
                >
                  Zamknúť
                </button>
                <button
                  onClick={() => updateSlot(s.id, "unlock")}
                  className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                  disabled={busy}
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
