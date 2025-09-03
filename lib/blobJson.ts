// lib/blobJson.ts
import { list, put } from '@vercel/blob';

/** Vždy čítaj najnovší JSON s cache-busterom. */
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

async function writeRaw(key: string, data: unknown, token: string) {
  await put(key, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    token,
  });
}

/**
 * Zápis s krátkou verifikáciou: 3 pokusy zápisu, po každom 3 verifikácie.
 * Držíme časy nízke, aby UI nevyzeralo spomalene.
 */
export async function writeJson<T extends { updatedAt?: string }>(
  key: string,
  data: T,
  tries = 3
): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN chýba vo Vercel env.');

  const expectedStamp = (data as any)?.updatedAt;

  let lastErr: unknown;

  for (let i = 0; i < Math.max(1, tries); i++) {
    try {
      await writeRaw(key, data, token);

      // krátka verifikácia (3 pokusy: 120ms, 240ms, 480ms)
      for (let v = 0; v < 3; v++) {
        const fresh = await readJson<any>(key, null as any);
        if (!expectedStamp || (fresh && fresh.updatedAt === expectedStamp)) return;
        await new Promise(r => setTimeout(r, 120 * Math.pow(2, v)));
      }
      // ak verifikácia neprešla, skúsime ešte jeden celý cyklus
      throw new Error('verify-after-write');
    } catch (e) {
      lastErr = e;
      // krátky backoff medzi cyklami zápisu (150ms, 300ms…)
      await new Promise(r => setTimeout(r, 150 * Math.pow(2, i)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Zápis do Blobu zlyhal.');
}
