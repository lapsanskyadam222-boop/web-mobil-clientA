import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export async function GET() {
  try {
    const { blobs } = await list({ prefix: 'site-content.json' });
    const latest = blobs.sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    )[0];

    if (!latest) {
      return NextResponse.json({
        logoUrl: null,
        carousel: [],
        text: '',
        updatedAt: ''
      });
    }

    const res = await fetch(latest.url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({
        logoUrl: null,
        carousel: [],
        text: '',
        updatedAt: ''
      });
    }

    const json = await res.json();
    return NextResponse.json({
      logoUrl: json.logoUrl ?? null,
      carousel: json.carousel ?? [],
      text: json.text ?? '',
      updatedAt: json.updatedAt ?? ''
    });
  } catch (e) {
    return NextResponse.json({
      logoUrl: null,
      carousel: [],
      text: '',
      updatedAt: ''
    });
  }
}
