// app/admin/slots/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Client from './Client';

export default function Page() {
  return <Client />;
}
