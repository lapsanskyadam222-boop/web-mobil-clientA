// app/rezervacia/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Slot = { id: string; date: string; time: string; locked?: boolean; booked?: boolean; };

export default function RezervaciaPage() {
  const router = useRouter();

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeDay, setActiveDay] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/slots", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Nepodarilo sa načítať sloty.");
        if (!mounted) return;
        setSlots(json.slots || []);
        const firstDay = (json.slots || [])
          .map((s: Slot) => s.date)
          .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
          .sort()[0];
        setActiveDay(firstDay || "");
      } catch (e: any) {
        setError(e?.message || "Chyba pri načítavaní slotov.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  const days = useMemo(() => {
    const set = new Set(slots.map(s => s.date));
    return Array.from(set).sort();
  }, [slots]);

  const daySlots = useMemo(
    () => slots.filter(s => s.date === activeDay && !s.locked && !s.booked),
    [activeDay, slots]
  );

  const phoneOk = phone.replace(/\D/g, "").length >= 9;

  async function submitReservation() {
    if (!selectedSlot || !name || !phoneOk) {
      alert("Prosím vyber si termín a vyplň meno + platný telefón.");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: selectedSlot.id, name, phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Rezervácia zlyhala.");

      // presmeruj na success stránku
      router.push("/rezervacia/success");
    } catch (e: any) {
      alert(e?.message || "Chyba pri odosielaní.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-8">Načítavam…</main>;
  if (error) return <main className="mx-auto max-w-3xl px-4 py-8 text-red-600">Chyba: {error}</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Rezervácia</h1>

      {/* Prepínač dní */}
      <div className="flex flex-wrap gap-2 mb-6">
        {days.map(d => (
          <button
            key={d}
            onClick={() => { setActiveDay(d); setSelectedSlot(null); }}
            className={`rounded-lg border px-3 py-2 ${d === activeDay ? "bg-black text-white" : "hover:bg-gray-100"}`}
            title={new Date(d).toLocaleDateString("sk-SK")}
          >
            {new Date(d).toLocaleDateString("sk-SK", { weekday: "short", day: "2-digit", month: "2-digit" })}
          </button>
        ))}
      </div>

      {/* Sloty */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-8">
        {daySlots.length === 0 && <p className="text-sm text-gray-600">Žiadne voľné časy pre tento deň.</p>}
        {daySlots.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSlot(s)}
            className={`rounded-xl border px-3 py-3 text-center ${selectedSlot?.id === s.id ? "bg-black text-white" : "hover:bg-gray-100"}`}
          >
            {s.time}
          </button>
        ))}
      </div>

      {/* Formulár */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Meno</label>
          <input className="rounded-lg border px-3 py-2" value={name} onChange={e => setName(e.target.value)} placeholder="Tvoje meno" />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Telefón</label>
          <input className="rounded-lg border px-3 py-2" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+421 ..." />
          {phone && !phoneOk && (
            <p className="text-xs text-red-600">Zadaj platný telefón (min. 9 číslic).</p>
          )}
        </div>

        <div className="pt-2">
          <button
            onClick={submitReservation}
            className="w-full rounded-xl bg-black px-6 py-3 text-white hover:bg-gray-800 transition disabled:opacity-50"
            disabled={!selectedSlot || saving || !name || !phoneOk}
          >
            {saving ? "Odosielam…" : selectedSlot ? `Rezervovať ${selectedSlot.date} ${selectedSlot.time}` : "Vyber si termín"}
          </button>
        </div>

        <p className="text-xs text-gray-500">
          * Sloty sa čítajú z /api/slots a rezervácia sa odosiela na /api/reservations.
        </p>
      </div>
    </main>
  );
}
