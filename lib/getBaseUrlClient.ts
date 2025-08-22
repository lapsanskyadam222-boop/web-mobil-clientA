// lib/getBaseUrlClient.ts

/**
 * Base URL pre CLIENT komponenty (prehliadač).
 * - V prehliadači použije window.location.origin.
 * - Pri build/SSR fallback na NEXT_PUBLIC_BASE_URL.
 */
export function getBaseUrlClient(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? '';
}
