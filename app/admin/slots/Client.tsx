// app/admin/slots/Client.tsx
"use client";

import * as React from "react";

export type Slot = {
  id: string;
  date: string;   // "YYYY-MM-DD"
  time: string;   // "HH:mm"
  locked?: boolean;
  booked?: boolean;
  // capacity?: number; // (pridáme neskôr)
};

type Props = {
  slots: Slot[];
  baseUrl: string;
};

export default function AdminSlotsClient({ slots }: Props) {
  // Dočasný skelet – nech to prejde buildom. UI doplníme v ďalšom kroku.
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Správa slotov</h1>
      <p className="text-sm opacity-70">
        Toto je dočasná klientská komponenta. Funkčný kalendár a ovládanie
        dorobíme v ďalšom commite.
      </p>

      <div className="mt-4 rounded border">
        <div className="px-3 py-2 text-sm border-b bg-gray-50">Náhľad dát:</div>
        <ul className="divide-y text-sm">
          {slots.slice(0, 10).map((s) => (
            <li key={s.id} className="px-3 py-2 flex gap-4">
              <span className="w-28">{s.date}</span>
              <span className="w-16">{s.time}</span>
              <span className="w-20">{s.locked ? "Zamknutý" : "Voľné"}</span>
              <span className="w-24">{s.booked ? "Rezervované" : "Neobsadené"}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
