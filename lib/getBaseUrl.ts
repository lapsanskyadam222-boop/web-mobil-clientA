// lib/getBaseUrl.ts
import 'server-only';
import { headers } from 'next/headers';

export function getBaseUrl() {
  // 1) ak je v env nastavená absolútna URL (napr. https://moj-web.vercel.app), použi ju
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL;
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv.replace(/\/+$/, '');

  // 2) inak poskladaj URL z hlavičiek (funguje lokálne aj na Verceli)
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}
