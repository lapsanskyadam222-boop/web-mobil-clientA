export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(req: Request) {
  try {
    // získaj súbor z request body
    const blob = await put(`uploads/${Date.now()}`, req.body as ReadableStream, {
      access: 'public',
    });

    return NextResponse.json({ url: blob.url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'upload error' }, { status: 500 });
  }
}
