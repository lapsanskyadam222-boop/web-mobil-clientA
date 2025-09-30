// app/api/upload/route.ts
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB – bezpečný strop po downscale

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!ALLOWED.some(t => contentType.startsWith(t.replace('*','')))) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 });
    }

    // (voliteľná) ochrana proti extrémne veľkým telám: skopíruj stream do Blob a skontroluj dĺžku
    const arrayBuf = await req.arrayBuffer();
    if (arrayBuf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    // ulož do Blob Storage – public
    const key = `uploads/${Date.now()}`;
    const saved = await put(key, arrayBuf, {
      access: 'public',
      contentType,
    });

    return NextResponse.json({ url: saved.url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'upload error' }, { status: 500 });
  }
}
