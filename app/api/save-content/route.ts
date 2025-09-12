import { NextResponse } from 'next/server';
import { writeJson } from '@/lib/blobJson';
import type { SiteContent } from '@/lib/types';

export const runtime = 'edge';

function isStrArray(a: unknown) {
  return Array.isArray(a) && a.every((x) => typeof x === 'string');
}

function clampImages(arr: string[], max = 10) {
  // očistíme, odstránime duplikáty, zrežeme na max
  const clean = arr.filter(Boolean).map(String);
  const unique = Array.from(new Set(clean));
  return unique.slice(0, max);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<SiteContent>;

    const logoUrl = (body.logoUrl ?? null) as string | null;
    const hero = isStrArray(body.hero) ? clampImages(body.hero) : [];
    const heroText = typeof body.heroText === 'string' ? body.heroText : '';
    const gallery = isStrArray(body.gallery) ? clampImages(body.gallery) : [];
    const bodyText = typeof body.bodyText === 'string' ? body.bodyText : '';

    // všetko je dobrovoľné, max 10 fotiek per carousel
    const payload: SiteContent = { logoUrl, hero, heroText, gallery, bodyText };

    // ulož – prepíše existujúci JSON bez náhodného suffixu
    await writeJson('content/site.json', payload);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Save failed' },
      { status: 400 }
    );
  }
}
