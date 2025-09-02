import { list, put } from '@vercel/blob';

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { blobs } = await list({ prefix: key });
    const entry = blobs.find(b => b.pathname === key || b.url.endsWith('/' + key)) ?? blobs[0];
    if (!entry) return fallback;
    const res = await fetch(`${entry.url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(key: string, data: T, tries = 3): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN nie je nastavený.');
  }
  let lastErr: unknown;
  for (let i=0;i<tries;i++) {
    try {
      await put(key, JSON.stringify(data, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        token,
      });
      return;
    } catch (e) {
      lastErr = e;
      await new Promise(r=>setTimeout(r, 150 * Math.pow(2, i)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Zápis do Blobu zlyhal.');
}
