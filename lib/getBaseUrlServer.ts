import { headers } from 'next/headers';

/**
 * Server‑side base URL (pre route handlers a server komponenty).
 * 1) Uprednostní NEXT_PUBLIC_BASE_URL, ak je nastavené.
 * 2) Inak skladá URL z X-Forwarded-* hlavičiek (Vercel) alebo host/proto fallback.
 */
export function getBaseUrlServer(): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, '');

  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}
