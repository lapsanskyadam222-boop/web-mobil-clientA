// lib/blobJson.ts
import { list, put } from '@vercel/blob';

/**
 * Načíta JSON z Vercel Blob.
 * - používa cache-buster (ts) a no-store, aby sme obišli CDN cache
 * - ak súbor neexistuje, vráti fallback
 */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { blobs } = await list({ prefix: key });

    // Nájdeme presný záznam (bez random suffixu), inak zoberieme prvý
    const entry =
      blobs.find(b => b.pathname === key || b.url.endsWith('/' + key)) ??
      blobs[0];

    if (!entry) return fallback;

    const res = await fetch(`${entry.url}?ts=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/**
 * Zapíše JSON do Vercel Blob s krátkym retry (pre prípad dočasnej nekonzistencie).
 * - 3 pokusy, exponenciálny backoff ~150/300/600ms
 * - vyžaduje BLOB_READ_WRITE_TOKEN vo Verceli
 */
export async function writeJson<T>(key: string, data: T, tries = 3): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN nie je nastavený. Doplň ho vo Vercel → Project Settings → Environment Variables (Production aj Preview) a redeploy.'
    );
  }

  let lastErr: unknown;
  for (let i = 0; i < Math.max(1, tries); i++) {
    try {
      await put(key, JSON.stringify(data, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false, // chceme deterministický názov
        token,
      });
      return;
    } catch (e) {
      lastErr = e;
      // krátky backoff pred ďalším pokusom
      await new Promise((r) => setTimeout(r, 150 * Math.pow(2, i)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Zápis do Blobu zlyhal.');
}
