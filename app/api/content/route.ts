import { NextResponse } from 'next/server';
import { readJson } from '@/lib/blobJson';
import type { SiteContent } from '@/lib/types';

/**
 * Číta JSON z Vercel Blob (content/site.json).
 * Zachováva spätnú kompatibilitu so starou schémou:
 *  - logoUrl, carousel, text -> premapuje na hero/heroText
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  // kde ukladáme
  const PATH = 'content/site.json';

  // pokus o načítanie novej schémy
  const json = await readJson<any>(`https://blob.vercel-storage.com/${PATH}`);

  // fallback: ak nie je alebo je stará schéma, namapujeme
  let data: SiteContent;
  if (json && ('hero' in json || 'gallery' in json)) {
    data = {
      logoUrl: json.logoUrl ?? null,
      hero: Array.isArray(json.hero) ? json.hero : [],
      heroText: typeof json.heroText === 'string' ? json.heroText : '',
      gallery: Array.isArray(json.gallery) ? json.gallery : [],
      bodyText: typeof json.bodyText === 'string' ? json.bodyText : '',
    };
  } else {
    // STARÁ SCHÉMA: { logoUrl, carousel, text }
    data = {
      logoUrl: json?.logoUrl ?? null,
      hero: Array.isArray(json?.carousel) ? json.carousel : [],
      heroText: typeof json?.text === 'string' ? json.text : '',
      gallery: [],
      bodyText: '',
    };
  }

  return NextResponse.json(data, { status: 200 });
}
