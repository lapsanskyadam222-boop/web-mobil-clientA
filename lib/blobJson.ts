// lib/blobJson.ts
import { list, put } from '@vercel/blob';

/** Bezpečné čítanie JSON z Vercel Blob (s cache-busterom). */
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

async function writeRaw(key: string, data: unknown, token: string) {
  await put(key, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    token,
  });
}

/**
 * Spoľahlivý zápis s verifikáciou:
 * - 5 pokusov zápisu, exponenciálny backoff
 * - po zápise čítame späť a overujeme podľa `updatedAt`
 */
export async function writeJson<T>(key: string, data: T, tries = 5): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN chýba vo Vercel env.');

  let lastErr: unknown;

  for (let i = 0; i < Math.max(1, tries); i++) {
    try {
      await writeRaw(key, data, token);

      // verify-after-write: skúšame niekoľkokrát prečítať späť
      for (let v = 0; v < 5; v++) {
        const fresh = await readJson<any>(key, null as any);
        if (fresh && fresh.updatedAt === (data as any)?.updatedAt) return;
        await new Promise(r => setTimeout(r, 120 * Math.pow(2, v))); // 120, 240, 480, 960, 1920 ms
      }
      throw new Error('Verify-after-write zlyhalo');
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 150 * Math.pow(2, i))); // 150, 300, 600, 1200, 2400 ms
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Zápis do Blobu zlyhal.');
}
