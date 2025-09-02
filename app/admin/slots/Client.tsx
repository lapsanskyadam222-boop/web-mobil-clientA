'use client';

export type Slot = {
  id: string;
  date: string;
  time: string;
  locked?: boolean;
  booked?: boolean;
  // capacity?: number;      // doplníme neskôr
  // bookedCount?: number;   // doplníme neskôr
};

type Props = {
  slots: Slot[];
};

export default function AdminSlotsClient({ slots }: Props) {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Správa slotov</h1>
      <p className="text-sm opacity-70 mb-4">
        Dočasný skelet – kalendár a ovládanie doplníme v ďalšom kroku.
      </p>

      <div className="rounded border p-3">
        <div className="px-3 py-2 text-sm border-b bg-gray-50">Náhľad dát:</div>
        <ul className="divide-y text-sm">
          {slots.slice(0, 10).map((s) => (
            <li key={s.id} className="px-3 py-2 flex gap-4">
              <span className="min-w-[90px]">{s.date}</span>
              <span className="min-w-[60px]">{s.time}</span>
              <span className="opacity-60">
                {s.locked ? 'Zamknuté' : s.booked ? 'Rezervované' : 'Voľné'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
