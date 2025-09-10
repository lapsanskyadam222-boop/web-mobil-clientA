"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Slot = {
  id: string;
  date: string;
  time: string;
  locked?: boolean;
  booked?: boolean;
  capacity?: number;
};

export default function AdminSlotsClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [cap, setCap] = useState(1);

  // --- fetch
  async function fetchSlots() {
    const res = await fetch(`/api/slots?t=${Date.now()}`, { cache: "no-store" });
    const j = await res.json();
    setSlots(Array.isArray(j?.slots) ? j.slots : []);
  }

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        await fetchSlots();
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  // --- debounce refetch
  const refTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleRefetch(ms = 300) {
    if (refTimer.current) clearTimeout(refTimer.current);
    refTimer.current = setTimeout(async () => {
      try {
        await fetchSlots();
      } finally {
        refTimer.current = null;
      }
    }, ms);
  }
  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 700);
  }

  // --- optimistic helpers
  function patchLocal(id: string, p: Partial<Slot>) {
    setSlots((curr) => {
      const i = curr.findIndex((x) => x.id === id);
      if (i < 0) return curr;
      const next = curr.slice();
      next[i] = { ...curr[i], ...p };
      return next;
    });
  }
  function removeLocal(id: string) {
    setSlots((curr) => curr.filter((s) => s.id !== id));
  }

  // --- actions
  async function toggleLock(s: Slot) {
    patchLocal(s.id, { locked: !s.locked });
    try {
      await fetch("/api/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, action: s.locked ? "unlock" : "lock" }),
      });
      scheduleRefetch();
      flashSaved();
    } catch {
      scheduleRefetch(0);
    }
  }

  async function changeCap(s: Slot, value: number) {
    const safe = Math.max(1, Number.isFinite(+value) ? +value : 1);
    patchLocal(s.id, { capacity: safe });
    try {
      await fetch("/api/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, action: "capacity", capacity: safe }),
      });
      scheduleRefetch();
      flashSaved();
    } catch {
      scheduleRefetch(0);
    }
  }

  async function removeOne(s: Slot) {
    removeLocal(s.id);
    try {
      await fetch("/api/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, action: "delete" }),
      });
      scheduleRefetch();
      flashSaved();
    } catch {
      scheduleRefetch(0);
    }
  }

  async function restoreOne(s: Slot) {
    try {
      await fetch("/api/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, action: "free" }),
      });
      scheduleRefetch();
      flashSaved();
    } catch {
      scheduleRefetch(0);
    }
  }

  // group by day
  const grouped = useMemo(() => {
    const by: Record<string, Slot[]> = {};
    for (const s of slots) (by[s.date] ||= []).push(s);
    for (const d of Object.keys(by)) by[d].sort((a, b) => (a.time < b.time ? -1 : 1));
    return Object.entries(by).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [slots]);

  if (loading) return <main className="p-6">Načítavam…</main>;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Správa slotov</h1>
        {saved && <span className="text-green-600 text-sm">Uložené ✓</span>}
      </div>

      <div className="space-y-4">
        {grouped.map(([day, list]) => (
          <div key={day} className="rounded border">
            <div className="px-3 py-2 text-sm font-semibold bg-gray-50">
              {day}
            </div>
            <div className="p-3 space-y-2">
              {list.map((s) => (
                <div key={s.id} className="flex items-center">
                  {/* Ľavá časť */}
                  <div className="flex-1 flex items-center gap-4">
                    <div className="w-16">{s.time}</div>
                    <input
                      type="number"
                      min={1}
                      value={s.capacity ?? 1}
                      onChange={(e) => changeCap(s, Number(e.target.value) || 1)}
                      className="border rounded px-2 py-1 w-20"
                    />
                    <div className="text-xs opacity-70 w-24">
                      {s.locked ? "Zamknuté" : "Voľné"}
                    </div>
                  </div>

                  {/* Pravá časť - tlačidlá zarovnané doprava */}
                  <div className="flex gap-2 justify-end w-72">
                    <button
                      onClick={() => toggleLock(s)}
                      className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                      {s.locked ? "Odomknúť" : "Zamknúť"}
                    </button>
                    <button
                      onClick={() => removeOne(s)}
                      className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 text-red-600"
                    >
                      Vymazať
                    </button>
                    <button
                      onClick={() => restoreOne(s)}
                      className="px-2 py-1 rounded bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      Obnoviť
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
