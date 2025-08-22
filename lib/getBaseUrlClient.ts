// lib/getBaseUrlClient.ts

/**
 * Vracia absolútnu base URL na klientovi.
 * V prehliadači použije window.location.origin,
 * inak (napr. počas build-time) sáhne po NEXT_PUBLIC_BASE_URL.
 */
export function getBaseUrlClient(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? '';
}
