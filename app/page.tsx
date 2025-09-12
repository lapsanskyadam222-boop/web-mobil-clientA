// app/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import Carousel from '@/components/Carousel';
import type { SiteContent } from '@/lib/types';
import { getBaseUrlServer } from '@/lib/getBaseUrlServer';

async function getContent(): Promise<
  { ok: true; data: SiteContent } | { ok: false; error?: string; status?: number }
> {
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

  const data = result.data!;
  const logoUrl = data.logoUrl ?? null;
  const images = Array.isArray(data.carousel) ? data.carousel : [];
  const text = data.text ?? '';

  // Výpočet farieb podľa témy
  let bg = '#ffffff';
  let fg = '#111111';
  const mode = data.theme?.mode ?? 'light';

  if (mode === 'dark') {
    bg = '#000000';
    fg = '#ffffff';
  } else if (mode === 'custom') {
    bg = data.theme?.bgColor || bg;
    fg = data.theme?.textColor || fg;
  }

  return (
    <main className="min-h-dvh antialiased" style={{ background: bg, color: fg }}>
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

        {/* CAROUSEL – centrovaný na stred */}
        {images.length > 0 && (
          <div className="w-full flex justify-center">
            <div className="w-full" style={{ maxWidth: 'min(92vw, 900px)' }}>
              <Carousel images={images} aspect="4/5" className="w-full" />
            </div>
          </div>
        )}

        {/* TEXT */}
        {text ? (
          <article
            className="prose text-center"
            style={{ maxWidth: 'min(92vw, 900px)', whiteSpace: 'pre-line' }} // zachová odseky \n
          >
            {text}
          </article>
        ) : (
          <p className="text-sm opacity-60">Zatiaľ žiadny text.</p>
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
