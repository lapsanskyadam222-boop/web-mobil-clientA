// app/admin/slots/page.tsx
export const revalidate = 0;

import AdminSlotsClient from './Client';
import { getBaseUrlServer } from '@/lib/getBaseUrlServer';

type Slot = {
  id: string;
  date: string;     // YYYY-MM-DD
  time: string;     // HH:mm
  locked?: boolean;
  booked?: boolean;
  capacity?: number;
  bookedCount?: number;
};

async function getSlots(): Promise<Slot[]> {
  try {
    const base = getBaseUrlServer();
    const res = await fetch(`${base}/api/slots?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j?.slots) ? (j.slots as Slot[]) : [];
  } catch {
    return [];
  }
}

export default async function AdminSlotsPage() {
  const slots = await getSlots();
  return <AdminSlotsClient slots={slots} />;
}
