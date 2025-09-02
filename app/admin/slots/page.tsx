// app/admin/slots/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import AdminSlotsClient from './Client';

type Slot = {
  id: string; date: string; time: string;
  locked?: boolean; booked?: boolean;
  capacity?: number; bookedCount?: number;
};

async function getSlots(): Promise<Slot[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/slots?t=${Date.now()}`, { cache: 'no-store' });
    const j = await res.json();
    return Array.isArray(j?.slots) ? (j.slots as Slot[]) : [];
  } catch {
    return [];
  }
}

export default async function AdminSlotsPage() {
  const slots = await getSlots();
  return <AdminSlotsClient initial={slots} />;
}
