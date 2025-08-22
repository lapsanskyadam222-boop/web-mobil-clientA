import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export async function GET() {
  try {
    // berieme najnovší JSON s prefixom
    const { blobs } = await list({ prefix: 'site-content-' });

    if (!blobs.length) {
      return NextResponse.json({
        logoUrl: null,
        carousel: [],
        text: '',
        updatedAt: '',
      });
    }

    const latest = blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];

    // ak by si predsa len narazil na CDN cache, dáme cache-buster
    const res = await fetch(`${latest.url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({
        logoUrl: null,
        carousel: [],
        text: '',
        updatedAt: '',
      });
    }

    const json = await res.json();
    return NextResponse.json({
      logoUrl: json.logoUrl ?? null,
      carousel: Array.isArray(json.carousel) ? json.carousel : [],
      text: json.text ?? '',
      updatedAt: json.updatedAt ?? '',
    });
  } catch {
    return NextResponse.json({
      logoUrl: null,
      carousel: [],
      text: '',
      updatedAt: '',
    });
  }
}
