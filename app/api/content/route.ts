// app/api/content/route.ts
import { NextResponse } from 'next/server';
import type { SiteContent } from '@/lib/types';
import { readJson } from '@/lib/blobJson';

export const runtime = 'edge';

const BLOB_PATH = 'web-content.json';

export async function GET() {
  try {
    // Môže vrátiť null, ak ešte neexistuje.
    const raw = await readJson<any>(BLOB_PATH);

    // Spätná kompatibilita:
    // - ak je staré pole `carousel`/`text`, mapneme na carousel1/text1
    const content: SiteContent = {
      logoUrl: raw?.logoUrl ?? null,
      carousel1: Array.isArray(raw?.carousel1)
        ? raw.carousel1
        : Array.isArray(raw?.carousel)
          ? raw.carousel
          : [],
      text1: typeof raw?.text1 === 'string'
        ? raw.text1
        : typeof raw?.text === 'string'
          ? raw.text
          : '',
      carousel2: Array.isArray(raw?.carousel2) ? raw.carousel2 : [],
      text2: typeof raw?.text2 === 'string' ? raw.text2 : '',
    };

    return NextResponse.json(content, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to read content' },
      { status: 500 }
    );
  }
}
