/**
 * Client‑side base URL (pre 'use client' komponenty).
 * Ak bežíme v prehliadači, použijeme window.location.origin,
 * inak fallback na NEXT_PUBLIC_BASE_URL.
 */
export function getBaseUrlClient(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? '';
}
