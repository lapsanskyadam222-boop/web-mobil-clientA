"use client";
import { useEffect, useState } from "react";

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean };

export default function AdminSlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadSlots() {
    setLoading(true);
    const res = await fetch("/api/slots", { cache: "no-store" });
    const json = await res.json();
    setSlots(json.slots || []);
    setLoading(false);
  }

  useEffect(() => { loadSlots(); }, []);

  async function addSlot() {
    if (!date || !time) return alert("Zadaj dátum aj čas");
    await fetch("/api/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, time }),
    });
    setDate(""); setTime("");
    loadSlots();
  }

  async function updateSlot(id: string, action: "lock" | "unlock" | "delete") {
    await fetch("/api/slots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    loadSlots();
  }

  if (loading) return <main className="p-6">Načítavam sloty…</main>;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold mb-6">Správa slotov</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button
          onClick={addSlot}
          className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800"
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
          {slots.map(s => (
            <tr key={s.id}>
              <td className="border px-2 py-1">{s.date}</td>
              <td className="border px-2 py-1">{s.time}</td>
              <td className="border px-2 py-1">
                {s.booked ? "Rezervované" : s.locked ? "Zamknuté" : "Voľné"}
              </td>
              <td className="border px-2 py-1 space-x-1">
                <button
                  onClick={() => updateSlot(s.id, "lock")}
                  className="px-2 py-1 border rounded hover:bg-gray-100"
                >
                  Zamknúť
                </button>
                <button
                  onClick={() => updateSlot(s.id, "unlock")}
                  className="px-2 py-1 border rounded hover:bg-gray-100"
                >
                  Odomknúť
                </button>
                <button
                  onClick={() => updateSlot(s.id, "delete")}
                  className="px-2 py-1 border rounded text-red-600 hover:bg-gray-100"
                >
                  Vymazať
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
