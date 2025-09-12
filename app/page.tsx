// app/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import Carousel from '@/components/Carousel';
import type { SiteContent } from '@/lib/types';
import { getBaseUrlServer } from '@/lib/getBaseUrlServer';

async function getContent(): Promise<SiteContent | null> {
  try {
    const base = getBaseUrlServer();
    const res = await fetch(`${base}/api/content`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as SiteContent;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const data = (await getContent()) ?? {
    logoUrl: null,
    hero: [],
    heroText: '',
    gallery: [],
    bodyText: '',
  };

  const logoUrl = data.logoUrl;

  return (
    <main className="min-h-dvh bg-white text-gray-900 antialiased">
      {/* STICKY PÁS S LOGOM (iba na tejto stránke) */}
      <header
        className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b"
        style={{ borderColor: '#eee' }}
      >
        <div className="mx-auto max-w-screen-sm p-3 flex justify-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="logo"
              className="h-14 w-auto"
              draggable={false}
            />
          ) : (
            <div className="h-14" />
          )}
        </div>
      </header>

      {/* OBSAH */}
      <div className="mx-auto max-w-screen-sm p-4 flex flex-col items-center gap-8">
        {/* CAROUSEL #1 */}
        {data.hero.length > 0 && (
          <div className="w-full flex justify-center">
            <div className="w-full" style={{ maxWidth: 'min(92vw, 900px)' }}>
              <Carousel images={data.hero} aspect="4/5" className="w-full" />
            </div>
          </div>
        )}

        {/* TEXT #1 */}
        {data.heroText && (
          <article className="prose text-center" style={{ maxWidth: 'min(92vw, 900px)' }}>
            {data.heroText}
          </article>
        )}

        {/* CAROUSEL #2 */}
        {data.gallery.length > 0 && (
          <div className="w-full flex justify-center">
            <div className="w-full" style={{ maxWidth: 'min(92vw, 900px)' }}>
              <Carousel images={data.gallery} aspect="4/5" className="w-full" />
            </div>
          </div>
        )}

        {/* TEXT #2 */}
        {data.bodyText && (
          <article className="prose text-center" style={{ maxWidth: 'min(92vw, 900px)' }}>
            {data.bodyText}
          </article>
        )}

        {/* CTA – „Rezervácie“ */}
        <div className="mt-2 w-full flex justify-center">
          <Link href="/rezervacia" aria-label="Rezervácie" className="inline-block active:translate-y-[1px] transition">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cta/rezervacie-btn.svg"
              alt="Rezervácie"
              className="h-16 w-auto select-none"
              draggable={false}
            />
          </Link>
        </div>
      </div>
    </main>
  );
}
