// lib/getBaseUrlServer.ts
import { headers } from 'next/headers';

/**
 * Base URL pre SERVER komponenty a Route Handlery.
 * - Ak je zadané NEXT_PUBLIC_BASE_URL, použije sa to (bez koncového /).
 * - Inak sa poskladá z X-Forwarded-* hlavičiek (Vercel) alebo z host/proto.
 */
export function getBaseUrlServer(): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, '');

  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('x-forwarded-host')  ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}
