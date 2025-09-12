// app/api/save-content/route.ts
export const runtime = 'edge';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { writeJson } from '@/lib/blobJson';

const CONTENT_BLOB_PATH = 'content/site.json';

type SavePayload = {
  logoUrl: string | null;
  carousel1: string[];
  text1: string;
  carousel2: string[];
  text2: string;
};

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((s) => typeof s === 'string');
}

function sanitizeUrl(u: string) {
  return u.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SavePayload>;

    const logoUrl =
      body.logoUrl === null
        ? null
        : typeof body.logoUrl === 'string'
        ? sanitizeUrl(body.logoUrl)
        : null;

    const c1 = isStringArray(body.carousel1) ? body.carousel1.map(sanitizeUrl).filter(Boolean) : [];
    const c2 = isStringArray(body.carousel2) ? body.carousel2.map(sanitizeUrl).filter(Boolean) : [];
    const t1 = typeof body.text1 === 'string' ? body.text1 : '';
    const t2 = typeof body.text2 === 'string' ? body.text2 : '';

    // limity – ako si chcel: 0–10 fotiek na každý carousel
    if (c1.length > 10 || c2.length > 10) {
      return NextResponse.json(
        { error: 'Maximálne 10 obrázkov v každom carousele.' },
        { status: 400 },
      );
    }

    const toSave: SavePayload = {
      logoUrl,
      carousel1: c1,
      text1: t1,
      carousel2: c2,
      text2: t2,
    };

    await writeJson(CONTENT_BLOB_PATH, toSave);

    return NextResponse.json({ ok: true, data: toSave }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to save content' },
      { status: 500 },
    );
  }
}
