'use client';

import * as React from 'react';

type Slot = {
  id: string;
  date: string;      // "YYYY-MM-DD"
  time: string;      // "HH:mm"
  capacity: number;
  bookedCount: number;
};

type CalendarProps = {
  className?: string;
  selectedDate?: string;
  onDateChange?: (isoDate: string) => void;
};

type Props = {
  slots?: Slot[];
  CalendarComponent?: React.ComponentType<CalendarProps>;
  onSetCapacity?: (slotId: string, capacity: number) => Promise<void> | void;
  onAddTime?: (dateISO?: string) => Promise<void> | void;
  onQuickFill?: (dateISO?: string) => Promise<void> | void;
  onClearDay?: (dateISO?: string) => Promise<void> | void;
  onResetAll?: () => Promise<void> | void;
};

export default function Client({
  slots = [],
  CalendarComponent,
  onSetCapacity,
  onAddTime,
  onQuickFill,
  onClearDay,
  onResetAll,
}: Props) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const firstWithData = slots[0]?.date ?? todayISO;
  const [selectedDate, setSelectedDate] = React.useState<string>(firstWithData);
  const [editing, setEditing] = React.useState<{ id: string; value: string } | null>(null);

  React.useEffect(() => {
    if (!slots.some((s) => s.date === selectedDate)) {
      setSelectedDate(slots[0]?.date ?? todayISO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const daySlots = React.useMemo(
    () => slots.filter((s) => s.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time)),
    [slots, selectedDate]
  );

  const handleCapacityCommit = async (slot: Slot, raw: string) => {
    const num = Number(raw);
    setEditing(null);
    if (!Number.isNaN(num) && num !== slot.capacity) {
      await onSetCapacity?.(slot.id, num);
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 px-3 md:px-4 lg:px-6 space-y-4 overflow-x-hidden">
      {/* KALENDÁR */}
      <section className="w-full max-w-full min-w-0 overflow-x-hidden">
        {CalendarComponent ? (
          <CalendarComponent
            className="w-full"
            selectedDate={selectedDate}
            onDateChange={(d) => d && setSelectedDate(d)}
          />
        ) : (
          <div className="w-full border rounded-xl p-3 flex items-center gap-3">
            <span className="text-sm text-gray-600">Vybrať deň:</span>
            <input
              type="date"
              className="border rounded-md px-2 py-1"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        )}
      </section>

      {/* PANEL S NASTAVENIAMI – flex-wrap, bez overflow mimo panelu */}
      <section className="w-full max-w-full min-w-0">
        <div className="w-full max-w-full min-w-0">
          <div className="flex flex-wrap items-center gap-2 py-2">
            <button
              onClick={() => onAddTime?.(selectedDate)}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 whitespace-nowrap"
            >
              Pridať čas
            </button>
            <button
              onClick={() => onQuickFill?.(selectedDate)}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 whitespace-nowrap"
            >
              Rýchle doplnenie
            </button>
            <button
              onClick={() => onClearDay?.(selectedDate)}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 whitespace-nowrap"
            >
              Vyčistiť deň
            </button>
            <button
              onClick={() => onResetAll?.()}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 whitespace-nowrap"
            >
              Resetovať všetko
            </button>
          </div>
        </div>
      </section>

      {/* DESKTOP TABUĽKA (≥640px) */}
      <section className="hidden sm:block w-full max-w-full min-w-0">
        <table className="w-full table-fixed border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-sm text-gray-600">
              <th className="px-3 py-2 w-[120px]">Dátum</th>
              <th className="px-3 py-2 w-[110px]">Čas</th>
              <th className="px-3 py-2 w-[64px] text-center">Kapacita</th>
              <th className="px-3 py-2 w-[90px] text-center">Obsadené</th>
              <th className="px-3 py-2">Akcia</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {daySlots.map((s) => {
              const isEditing = editing?.id === s.id;
              return (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 align-middle break-words">{s.date}</td>
                  <td className="px-3 py-2 align-middle">{s.time}</td>
                  <td className="px-2 py-2 align-middle text-center w-[64px]">
                    {isEditing ? (
                      <input
                        autoFocus
                        className="w-[56px] text-center border rounded-md px-1 py-1"
                        value={editing!.value}
                        inputMode="numeric"
                        onChange={(e) =>
                          setEditing({ id: s.id, value: e.target.value.replace(/\D/g, '') })
                        }
                        onBlur={() => handleCapacityCommit(s, editing!.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                    ) : (
                      <button
                        className="inline-flex items-center justify-center w-[56px] h-[32px] rounded-md border hover:bg-gray-50"
                        onClick={() => setEditing({ id: s.id, value: String(s.capacity) })}
                        title="Upraviť kapacitu"
                      >
                        {s.capacity}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2 align-middle text-center">{s.bookedCount}</td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50" disabled>
                        -1
                      </button>
                      <button className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50" disabled>
                        +1
                      </button>
                      {/* ďalšie akcie sem */}
                    </div>
                  </td>
                </tr>
              );
            })}
            {daySlots.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-gray-500" colSpan={5}>
                  Pre {selectedDate} nie sú žiadne sloty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* MOBILNÝ LIST VIEW (<640px) – žiadne horizontálne scrollovanie */}
      <section className="sm:hidden w-full max-w-full min-w-0 space-y-2">
        {daySlots.length === 0 && (
          <div className="text-sm text-gray-500 px-1">Pre {selectedDate} nie sú žiadne sloty.</div>
        )}
        {daySlots.map((s) => {
          const isEditing = editing?.id === s.id;
          return (
            <div key={s.id} className="rounded-xl border p-3">
              <div className="text-sm font-medium">{s.date}</div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-base font-semibold">{s.time}</div>
                <div className="text-xs text-gray-500">Obsadené: {s.bookedCount}</div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm">Kapacita:</span>
                {isEditing ? (
                  <input
                    autoFocus
                    className="w-[64px] text-center border rounded-md px-1 py-1"
                    value={editing!.value}
                    inputMode="numeric"
                    onChange={(e) =>
                      setEditing({ id: s.id, value: e.target.value.replace(/\D/g, '') })
                    }
                    onBlur={() => handleCapacityCommit(s, editing!.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                ) : (
                  <button
                    className="inline-flex items-center justify-center w-[64px] h-[34px] rounded-md border hover:bg-gray-50"
                    onClick={() => setEditing({ id: s.id, value: String(s.capacity) })}
                    title="Upraviť kapacitu"
                  >
                    {s.capacity}
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" disabled>
                  -1
                </button>
                <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" disabled>
                  +1
                </button>
                {/* ďalšie akcie sem */}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
