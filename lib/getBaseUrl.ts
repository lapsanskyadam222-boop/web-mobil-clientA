// lib/getBaseUrl.ts
/**
 * Robustná detekcia absolútnej URL pre serverové fetch-e.
 * Preferuje NEXT_PUBLIC_BASE_URL (ak ju neskôr pridáš),
 * inak skladá URL z X-Forwarded-* hlavičiek (Vercel) a host/proto fallback.
 */
import { headers } from 'next/headers';

export function getBaseUrl(): string {
  // 1) Ak by si niekedy chcel natvrdo nastaviť doménu vo Verceli:
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  }

  const h = headers();

  // Vercel posiela X-Forwarded-Proto/Host – použijeme ich, ak sú.
  const xfProto = h.get('x-forwarded-proto');
  const xfHost  = h.get('x-forwarded-host');

  if (xfProto && xfHost) {
    return `${xfProto}://${xfHost}`; // napr. https://web-xxx.vercel.app
  }

  // Fallback – ak by X-Forwarded-* neprišli:
  const host  = h.get('host') ?? 'localhost:3000';
  const proto = (h.get('x-forwarded-proto') ?? 'https').split(',')[0];

  return `${proto}://${host}`;
}
