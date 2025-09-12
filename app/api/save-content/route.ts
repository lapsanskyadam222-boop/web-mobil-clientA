// app/api/save-content/route.ts
import { NextResponse } from 'next/server';
import { writeJson } from '@/lib/blobJson';
import type { SiteContent } from '@/lib/types';

export const runtime = 'edge';

const BLOB_PATH = 'web-content.json';

// jednoduchý guard na reťazec
const isStr = (v: unknown) => typeof v === 'string';

// validácia poľa URL (struny) s dĺžkou 0..10
function validateImages(input: unknown, fieldName: string): string[] {
  const arr = Array.isArray(input) ? input : [];
  if (arr.length > 10) {
    throw new Error(`${fieldName}: maximálne 10 obrázkov`);
  }
  const allStrings = arr.every((x) => typeof x === 'string' && x.length > 0);
  if (!allStrings) {
    throw new Error(`${fieldName}: neplatný formát (očakávam pole URL stringov)`);
  }
  return arr as string[];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const payload: SiteContent = {
      logoUrl: body?.logoUrl ?? null,
      carousel1: validateImages(body?.carousel1, 'carousel1'),
      text1: isStr(body?.text1) ? body.text1 : '',
      carousel2: validateImages(body?.carousel2, 'carousel2'),
      text2: isStr(body?.text2) ? body.text2 : '',
    };

    // zápis do Blob-u (prepíše existujúci súbor)
    await writeJson<SiteContent>(BLOB_PATH, payload);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to save content' },
      { status: 400 }
    );
  }
}
