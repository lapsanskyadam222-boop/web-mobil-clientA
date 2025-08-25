// app/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Carousel from '@/components/Carousel';
import { SiteContent } from '@/lib/types';
import { getBaseUrlServer } from '@/lib/getBaseUrlServer';

async function getContent(): Promise<{ ok: boolean; data?: SiteContent; error?: string; status?: number }> {
  try {
    const base = getBaseUrlServer();
    const url = `${base}/api/content`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status, error: `Fetch ${url} failed with ${res.status}` };
    const json = (await res.json()) as SiteContent;
    return { ok: true, data: json };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Unknown fetch error' };
  }
}

export default async function HomePage() {
  const result = await getContent();

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-3xl p-4 text-center">
        <h1 className="mb-2 text-xl font-semibold">Načítanie obsahu zlyhalo</h1>
        <p className="mb-2 text-sm opacity-70">
          API nevrátilo žiadne dáta. Skús obnoviť stránku alebo pozri <code>/api/content</code>.
        </p>
        <pre className="whitespace-pre-wrap text-xs opacity-60">
          {result.status ? `HTTP ${result.status}\n` : ''}
          {result.error ?? ''}
        </pre>
      </main>
    );
  }

  const data = result.data!;
  const logoUrl = data.logoUrl ?? null;
  const images  = Array.isArray(data.carousel) ? data.carousel : [];
  const text    = data.text ?? '';

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center p-4 text-center">
      {/* LOGO */}
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="logo" className="h-16 w-auto" />
      )}

      {/* 0.5 cm ~ 8px (mt-2). Ak trváš na fyzických jednotkách: style={{ marginTop: '0.5cm' }} */}
      <div className="mt-2" />

      {/* CAROUSEL */}
      {images.length > 0 && (
        <Carousel
          images={images}
          aspect="4/5"
          className="w-full max-w-[min(92vw,900px)]"
        />
      )}

      {/* 0.5 cm pod carouselom */}
      <div className="mt-2" />

      {/* TEXT */}
      {text ? (
        <article className="prose max-w-none whitespace-pre-wrap text-base">{text}</article>
      ) : (
        <p className="text-sm opacity-60">Zatiaľ žiadny text.</p>
      )}
    </main>
  );
}
