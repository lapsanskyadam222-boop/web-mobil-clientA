// lib/getBaseUrlServer.ts
import { headers } from 'next/headers';

/**
 * Vracia absolútnu base URL na serveri.
 * Preferuje NEXT_PUBLIC_BASE_URL (ak je nastavená),
 * inak ju skladá z X-Forwarded-* hlavičiek (Vercel) alebo host/proto.
 */
export function getBaseUrlServer(): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, '');

  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('x-forwarded-host')  ?? h.get('host') ?? 'localhost:3000';

  return `${proto}://${host}`;
}
