// app/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import Carousel from '@/components/Carousel';
import { getBaseUrlServer } from '@/lib/getBaseUrlServer';

type Content = {
  logoUrl?: string | null;
  // starý model:
  carousel?: string[];
  text?: string;
  // nový model:
  carousel2?: string[];
  text2?: string;
};

async function getContent(): Promise<{ ok: true; data: Content } | { ok: false; status?: number; error?: string }> {
  try {
    const base = getBaseUrlServer();
    const res = await fetch(`${base}/api/content`, { cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status, error: `Fetch /api/content failed ${res.status}` };
    const data = (await res.json()) as any;

    // Zjemnená normalizácia – nič nie je povinné:
    const safe: Content = {
      logoUrl: data?.logoUrl ?? null,
      carousel: Array.isArray(data?.carousel) ? data.carousel : [],
      text: typeof data?.text === 'string' ? data.text : '',
      carousel2: Array.isArray(data?.carousel2) ? data.carousel2 : [],
      text2: typeof data?.text2 === 'string' ? data.text2 : '',
    };
    return { ok: true, data: safe };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unknown fetch error' };
  }
}

export default async function HomePage() {
  const r = await getContent();

  // Aj keby API zlyhalo, stránka nespadne:
  if (!r.ok) {
    return (
      <main className="mx-auto max-w-screen-sm p-4">
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto max-w-screen-sm p-3">
            {/* fallback logo – nič, len prázdny pás */}
          </div>
        </div>

        <h1 className="mt-6 mb-2 text-xl font-semibold">Načítanie obsahu zlyhalo</h1>
        <p className="text-sm opacity-70">Skús obnoviť stránku alebo pozri <code>/api/content</code>.</p>
        <pre className="mt-3 whitespace-pre-wrap text-xs opacity-60">
{`status: ${r.status ?? '-'}\n${r.error ?? ''}`}
        </pre>
      </main>
    );
  }

  const { logoUrl, carousel = [], text = '', carousel2 = [], text2 = '' } = r.data;

  return (
    <main className="min-h-dvh bg-white text-gray-900 antialiased">
      {/* Sticky LOGO bar */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b">
        <div className="mx-auto max-w-screen-sm p-3 flex justify-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="logo" className="h-12 w-auto select-none" draggable={false} />
          ) : (
            <div className="h-12" />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-screen-sm p-4 flex flex-col items-center gap-8">
        {/* Carousel #1 */}
        {carousel.length > 0 && (
          <div className="w-full flex justify-center">
            <div className="w-full" style={{ maxWidth: 'min(92vw, 900px)' }}>
              <Carousel images={carousel} aspect="4/5" className="w-full" />
            </div>
          </div>
        )}

        {/* Text #1 */}
        {text ? (
          <article className="prose text-center" style={{ maxWidth: 'min(92vw, 900px)' }}>
            {text}
          </article>
        ) : null}

        {/* Carousel #2 */}
        {carousel2.length > 0 && (
          <div className="w-full flex justify-center">
            <div className="w-full" style={{ maxWidth: 'min(92vw, 900px)' }}>
              <Carousel images={carousel2} aspect="4/5" className="w-full" />
            </div>
          </div>
        )}

        {/* Text #2 */}
        {text2 ? (
          <article className="prose text-center" style={{ maxWidth: 'min(92vw, 900px)' }}>
            {text2}
          </article>
        ) : null}

        {/* CTA */}
        <div className="mt-2 w-full flex justify-center">
          <Link href="/rezervacia" aria-label="Rezervácie" className="inline-block active:translate-y-[1px] transition">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cta/rezervacie-btn.svg" alt="Rezervácie" className="h-16 w-auto select-none" draggable={false} />
          </Link>
        </div>
      </div>
    </main>
  );
}
