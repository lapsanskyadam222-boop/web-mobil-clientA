// app/api/content/route.ts
export const runtime = 'edge';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { readJson } from '@/lib/blobJson';

const CONTENT_BLOB_PATH = 'content/site.json';

/** Starý formát (používaný doteraz) */
type LegacySiteContent = {
  logoUrl?: string | null;
  carousel?: string[];  // jedna galéria
  text?: string;        // jeden text
};

/** Nový formát (dva karusely + dva texty) */
type SiteContent = {
  logoUrl: string | null;
  carousel1: string[];
  text1: string;
  carousel2: string[];
  text2: string;
};

/** Transformácia starého formátu na nový */
function fromLegacy(data: LegacySiteContent | null): SiteContent {
  const logoUrl = data?.logoUrl ?? null;
  const c1 = Array.isArray(data?.carousel) ? data!.carousel!.filter(Boolean) : [];
  const t1 = (data?.text ?? '').toString();

  return {
    logoUrl,
    carousel1: c1,
    text1: t1,
    carousel2: [],
    text2: '',
  };
}

export async function GET(_req: NextRequest) {
  try {
    // môže byť už nový formát, alebo starý – načítame a normalizujeme
    const json = await readJson<any>(CONTENT_BLOB_PATH);

    let normalized: SiteContent;
    if (json && (Array.isArray(json.carousel1) || Array.isArray(json.carousel2))) {
      // Nový formát – jemné čistenie
      normalized = {
        logoUrl: json.logoUrl ?? null,
        carousel1: Array.isArray(json.carousel1) ? json.carousel1.filter(Boolean) : [],
        text1: (json.text1 ?? '').toString(),
        carousel2: Array.isArray(json.carousel2) ? json.carousel2.filter(Boolean) : [],
        text2: (json.text2 ?? '').toString(),
      };
    } else {
      // Starý formát -> premapujeme
      normalized = fromLegacy(json as LegacySiteContent | null);
    }

    return NextResponse.json(normalized, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to read content' },
      { status: 500 },
    );
  }
}
