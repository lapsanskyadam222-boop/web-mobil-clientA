import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export async function GET() {
  try {
    // najnovší JSON s prefixom
    const { blobs } = await list({ prefix: 'site-content-' });

    if (!blobs.length) {
      return NextResponse.json(
        {
          logoUrl: null,
          carousel: [],
          text: '',
          updatedAt: '',
          theme: { mode: 'light' },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const latest = blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];

    // cache-buster + no-store
    const res = await fetch(`${latest.url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        {
          logoUrl: null,
          carousel: [],
          text: '',
          updatedAt: '',
          theme: { mode: 'light' },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const json = await res.json();

    // spätná kompatibilita: ak v starších záznamoch chýba theme → light
    const theme =
      json?.theme && typeof json.theme === 'object'
        ? json.theme
        : { mode: 'light' };

    return NextResponse.json(
      {
        logoUrl: json.logoUrl ?? null,
        carousel: Array.isArray(json.carousel) ? json.carousel : [],
        text: json.text ?? '',
        updatedAt: json.updatedAt ?? '',
        theme,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      {
        logoUrl: null,
        carousel: [],
        text: '',
        updatedAt: '',
        theme: { mode: 'light' },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
