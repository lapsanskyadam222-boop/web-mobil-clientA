'use client';
import * as React from 'react';

export type Slot = {
  id: string;
  date: string;
  time: string;
  locked?: boolean;
  booked?: boolean;
  capacity?: number;
  bookedCount?: number;
};

type Props = { initial: Slot[] };

function groupByDate(slots: Slot[]) {
  const map = new Map<string, Slot[]>();
  for (const s of slots) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date)!.push(s);
  }
  for (const arr of map.values()) arr.sort((a,b)=> a.time.localeCompare(b.time));
  return Array.from(map.entries()).sort((a,b)=> a[0].localeCompare(b[0]));
}

export default function AdminSlotsClient({ initial }: Props) {
  const [slots, setSlots] = React.useState<Slot[]>(initial);
  const [busy, setBusy] = React.useState(false);

  // Form – pridanie časov do dňa
  const [newDate, setNewDate] = React.useState('');
  const [timesText, setTimesText] = React.useState('13:00, 14:00');
  const [cap, setCap] = React.useState<number>(1);

  async function refresh() {
    const res = await fetch('/api/slots?t=' + Date.now(), { cache: 'no-store' });
    const j = await res.json();
    setSlots(Array.isArray(j?.slots) ? j.slots : []);
  }

  async function addTimes() {
    if (!newDate) return alert('Vyber dátum.');
    const times = timesText.split(/[,\s]+/).map(s=>s.trim()).filter(Boolean);
    if (!times.length) return alert('Zadaj aspoň jeden čas.');
    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ date: newDate, times, capacity: cap }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'POST zlyhal');
      await refresh();
      setTimesText('');
    } catch (e:any) {
      alert(e?.message || 'Chyba pri pridávaní časov');
    } finally {
      setBusy(false);
    }
  }

  async function lockDay(date: string, lock: boolean) {
    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action: lock ? 'lockDay' : 'unlockDay', date }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'PATCH day zlyhal');
      await refresh();
    } catch (e:any) {
      alert(e?.message || 'Chyba pri lock/unlock dni');
    } finally {
      setBusy(false);
    }
  }

  async function setCapacity(id: string, capacity: number) {
    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id, action: 'setCapacity', capacity }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'PATCH capacity zlyhal');
      await refresh();
    } catch (e:any) {
      alert(e?.message || 'Chyba pri zmene kapacity');
    } finally {
      setBusy(false);
    }
  }

  async function lockSlot(id: string, lock: boolean) {
    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id, action: lock ? 'lock' : 'unlock' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'PATCH lock slot zlyhal');
      await refresh();
    } catch (e:any) {
      alert(e?.message || 'Chyba pri lock/unlock slote');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSlot(id: string) {
    if (!confirm('Vymazať slot?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/slots', {
        method: 'PATCH',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id, action: 'delete' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'PATCH delete zlyhal');
      await refresh();
    } catch (e:any) {
      alert(e?.message || 'Chyba pri mazaní slotu');
    } finally {
      setBusy(false);
    }
  }

  const groups = groupByDate(slots);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-1">Správa slotov</h1>
      <p className="text-sm opacity-70 mb-4">Kalendár doplníme – toto je funkčný základ na ukladanie.</p>

      {/* Form na pridanie časov */}
      <div className="rounded border p-3 mb-6">
        <div className="grid" style={{gridTemplateColumns: '160px 1fr 130px 120px', gap: 8}}>
          <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} className="border rounded px-2 py-1" />
          <input placeholder="13:00, 14:00, 15:30" value={timesText} onChange={e=>setTimesText(e.target.value)} className="border rounded px-2 py-1" />
          <input type="number" min={1} value={cap} onChange={e=>setCap(Math.max(1, Number(e.target.value)||1))} className="border rounded px-2 py-1" />
          <button disabled={busy} onClick={addTimes} className="rounded bg-black text-white px-3">Pridať časy</button>
        </div>
        <div className="text-xs opacity-70 mt-2">Dátum + zoznam časov (čiarky/medzery) + kapacita (počet ľudí).</div>
      </div>

      {/* Zoznam podľa dňa */}
      <div className="space-y-4">
        {groups.map(([date, arr]) => {
          const dayLocked = arr.every(s=>s.locked);
          return (
            <div key={date} className="rounded border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{date}</div>
                <div className="space-x-2">
                  <button onClick={()=>lockDay(date, !dayLocked)} className="rounded border px-2 py-1">
                    {dayLocked ? 'Odomknúť deň' : 'Zamknúť deň'}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {arr.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <div className="w-16">{s.time}</div>
                    <div className="w-28">stav: {s.locked ? 'zamknuté' : 'voľné'}</div>
                    <div className="w-40">
                      kapacita:
                      <input
                        type="number"
                        min={1}
                        defaultValue={s.capacity ?? 1}
                        onBlur={(e)=> setCapacity(s.id, Math.max(1, Number(e.target.value)||1))}
                        className="border rounded px-2 py-0.5 ml-2 w-20"
                        title="Zmeň a klikni mimo"
                      />
                    </div>
                    <button onClick={()=>lockSlot(s.id, !s.locked)} className="rounded border px-2 py-1">
                      {s.locked ? 'Odomknúť' : 'Zamknúť'}
                    </button>
                    <button onClick={()=>deleteSlot(s.id)} className="rounded border px-2 py-1">Vymazať</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!groups.length && <div className="text-sm opacity-70">Žiadne sloty. Pridaj časy vyššie.</div>}
      </div>
    </main>
  );
}
