// app/admin/slots/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import AdminSlotsClient from './Client';

export default function AdminSlotsPage() {
  return <AdminSlotsClient />;
}
