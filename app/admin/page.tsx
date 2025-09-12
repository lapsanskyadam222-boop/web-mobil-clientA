// app/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import Carousel from '@/components/Carousel';
import type { SiteContent } from '@/lib/types';
import { getBaseUrlServer } from '@/lib/getBaseUrlServer';

async function getContent(): Promise<{ ok: true; data: SiteContent } | { ok: false; error?: string; status?: number }> {
  try {
    const base = getBaseUrlServer();
    const url = `${base}/api/content`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status, error: `Fetch ${url} failed with ${res.status}` };
    const data = (await res.json()) as SiteContent;
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Unknown fetch error' };
  }
}

export default async function HomePage() {
  const result = await getContent();

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-2 text-xl font-semibold">Načítanie obsahu zlyhalo</h1>
        <pre className="whitespace-pre-wrap text-xs opacity-60">
          {result.status ? `HTTP ${result.status}\n` : ''}
          {result.error ?? ''}
        </pre>
      </main>
    );
  }

  const { logoUrl, carousel1, text1, carousel2, text2 } = result.data;

  return (
    <main className="min-h-dvh bg-white text-gray-900 antialiased">
      <div className="mx-auto max-w-screen-sm p-4 flex flex-col items-center gap-4">
        {/* LOGO */}
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="logo"
            className="mx-auto w-auto"
            style={{ height: 'clamp(100px, 22vw, 160px)', display: 'block' }}
          />
        )}

        {/* CAROUSEL #1 */}
        {Array.isArray(carousel1) && carousel1.length > 0 && (
          <div className="w-full flex justify-center">
            <div className="w-full" style={{ maxWidth: 'min(92vw, 900px)' }}>
              <Carousel images={carousel1} aspect="4/5" className="w-full" />
            </div>
          </div>
        )}

        {/* TEXT #1 */}
        {text1 && (
          <article className="prose text-center" style={{ maxWidth: 'min(92vw, 900px)' }}>
            {text1}
          </article>
        )}

        {/* CAROUSEL #2 */}
        {Array.isArray(carousel2) && carousel2.length > 0 && (
          <div className="w-full flex justify-center">
            <div className="w-full" style={{ maxWidth: 'min(92vw, 900px)' }}>
              <Carousel images={carousel2} aspect="4/5" className="w-full" />
            </div>
          </div>
        )}

        {/* TEXT #2 */}
        {text2 && (
          <article className="prose text-center" style={{ maxWidth: 'min(92vw, 900px)' }}>
            {text2}
          </article>
        )}

        {/* CTA */}
        <div className="mt-8 w-full flex justify-center">
          <Link href="/rezervacia" aria-label="Rezervácie" className="inline-block active:translate-y-[1px] transition">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cta/rezervacie-btn.svg" alt="Rezervácie" className="h-16 w-auto select-none" draggable={false} />
          </Link>
        </div>
      </div>
    </main>
  );
}
