// lib/blobJson.ts
import { list, put } from '@vercel/blob';

/**
 * Načíta JSON z Vercel Blob.
 * - používa no-store a cache-buster, aby sme obišli CDN cache
 * - ak súbor neexistuje, vráti fallback
 */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { blobs } = await list({ prefix: key });
    const entry =
      blobs.find(b => b.pathname === key || b.url.endsWith('/' + key)) ?? blobs[0];
    if (!entry) return fallback;

    const res = await fetch(`${entry.url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/**
 * Zapíše JSON do Vercel Blob.
 * - použije token, ak je k dispozícii; inak sa spolieha na managed režim vo Verceli
 * - 4 pokusy s backoff (200/400/800/1200ms)
 * - deterministický názov (addRandomSuffix:false)
 */
export async function writeJson<T>(key: string, data: T, tries = 4): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  let lastErr: unknown;

  for (let i = 0; i < Math.max(1, tries); i++) {
    try {
      await put(key, JSON.stringify(data, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        ...(token ? { token } : {}),
      });
      return;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 200 * (i + 1)));
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new Error('Zápis do Blobu zlyhal (neznáma chyba).');
}
