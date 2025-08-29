// lib/blobJson.ts
import { list, put } from '@vercel/blob';

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  // nájdeme súbor v Blob-e
  const { blobs } = await list({ prefix: key });
  if (!blobs.length) return fallback;
  const url = blobs[0].url;
  const res = await fetch(`${url}?ts=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return fallback;
  return (await res.json()) as T;
}

export async function writeJson<T>(key: string, data: T) {
  await put(key, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN, // musí byť nastavený vo Verceli
  });
}
