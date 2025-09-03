// lib/blobJson.ts
import { list, put } from '@vercel/blob';

/** Malá pauza (ms). */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Bezpečné čítanie JSON z Vercel Blob s cache-busterom.
 * - nájde prvý objekt s názvom `key` (alebo prvý pod prefixom)
 * - vždy fetchne s ?ts= aby obišiel edge cache
 */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { blobs } = await list({ prefix: key });

    const entry =
      blobs.find(b => b.pathname === key || b.url.endsWith('/' + key)) ??
      blobs[0];

    if (!entry) return fallback;

    const res = await fetch(`${entry.url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return fallback;

    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/**
 * Jednoduchý (tolerantný) zápis do Blob:
 * - žiadna prísna verifikácia, len jeden krát zapíše
 * - addRandomSuffix: false => prepisuje ten istý key
 * - po zápise krátka pauza (kvôli eventual consistency)
 */
export async function writeJsonLoose<T>(key: string, data: T): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN chýba vo Vercel env.');

  await put(key, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    token,
  });

  // krátke počkanie, aby sa nové dáta rozšírili
  await sleep(250);
}

/**
 * (Voliteľné) prísnejší zápis s pokusmi a ľahkou verifikáciou.
 * Ak ho nebudeš používať, kľudne ignoruj.
 */
export async function writeJsonStrict<T>(key: string, data: T, tries = 3): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN chýba vo Vercel env.');

  let lastErr: unknown;

  for (let i = 0; i < tries; i++) {
    try {
      await put(key, JSON.stringify(data, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        token,
      });

      // krátka verifikácia: prečítame späť a pozrieme updatedAt, ak existuje
      await sleep(200 + i * 150);
      const fresh = await readJson<any>(key, null as any);
      if (!fresh) throw new Error('verify read failed');
      if ((data as any)?.updatedAt && fresh?.updatedAt !== (data as any).updatedAt) {
        throw new Error('verify mismatch');
      }
      return;
    } catch (e) {
      lastErr = e;
      await sleep(200 + i * 200);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Zápis do Blobu zlyhal.');
}
