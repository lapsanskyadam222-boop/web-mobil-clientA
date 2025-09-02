export const dynamic = 'force-dynamic';
export const revalidate = 0;

import AdminSlotsClient from './Client';
import { getBaseUrlServer } from '@/lib/getBaseUrlServer';

type Slot = {
  id: string; date: string; time: string;
  locked?: boolean; booked?: boolean;
  capacity?: number; bookedCount?: number;
};

async function getSlots(): Promise<Slot[]> {
  try {
    const base = getBaseUrlServer();
    const r = await fetch(`${base}/api/slots?t=${Date.now()}`, { cache:'no-store' });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j?.slots) ? j.slots as Slot[] : [];
  } catch { return []; }
}

export default async function AdminSlotsPage(){
  const slots = await getSlots();
  return <AdminSlotsClient initial={slots} />;
}
