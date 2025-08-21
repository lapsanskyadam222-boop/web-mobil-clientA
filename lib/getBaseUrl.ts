// lib/getBaseUrl.ts

/**
 * Izomorfné zistenie base URL:
 * - v prehliadači vracia "" (použijú sa relatívne cesty)
 * - na serveri:
 *    1) NEXT_PUBLIC_BASE_URL ak je nastavené (napr. https://moj-web.vercel.app)
 *    2) VERCEL_URL (bez protokolu) -> doplní https://
 *    3) fallback na http://localhost:3000 (dev)
 */
export function getBaseUrl() {
  // Client: relatívne volania sú najbezpečnejšie
  if (typeof window !== 'undefined') return '';

  // Server: uprednostni explicitnú absolútnu URL
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return envBase;

  // Vercel poskytuje VERCEL_URL bez protokolu
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;

  // Lokálny vývoj
  return 'http://localhost:3000';
}
