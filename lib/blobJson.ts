// lib/blobJson.ts
import { list, put } from '@vercel/blob';

/** Bezpečné čítanie JSON z Vercel Blob (vždy čerstvé). */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { blobs } = await list({ prefix: key });

    // nájdi presný názov alebo prvý "matching" z prefixu
    const entry =
      blobs.find(b => b.pathname === key || b.url.endsWith('/' + key)) ??
      blobs[0];

    if (!entry) return fallback;

    // cache-buster + no-store
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
    addRandomSuffix: false, // kľúč je stabilný
    token,
  });
}

/**
 * Spoľahlivý zápis s verifikáciou:
 * - 5 pokusov zápisu (exponenciálny backoff)
 * - po zápise niekoľkokrát čítame späť a overujeme `updatedAt`
 */
export async function writeJson<T extends { updatedAt?: string }>(
  key: string,
  data: T,
  tries = 5
): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN chýba vo Vercel env.');

  // ak volajúci nenastavil updatedAt, doplníme
  if (!data.updatedAt) (data as any).updatedAt = new Date().toISOString();

  let lastErr: unknown;

  for (let i = 0; i < Math.max(1, tries); i++) {
    try {
      await writeRaw(key, data, token);

      // verify-after-write: skúšaj prečítať späť
      for (let v = 0; v < 5; v++) {
        const fresh = await readJson<any>(key, null as any);
        if (fresh && fresh.updatedAt === (data as any).updatedAt) return;
        await new Promise(r => setTimeout(r, 120 * Math.pow(2, v)));
      }
      throw new Error('Verify-after-write zlyhalo');
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 150 * Math.pow(2, i)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Zápis do Blobu zlyhal.');
}
