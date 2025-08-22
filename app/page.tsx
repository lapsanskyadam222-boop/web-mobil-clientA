// app/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Carousel from '@/components/Carousel';
import { SiteContent } from '@/lib/types';
import { getBaseUrl } from '@/lib/getBaseUrl';

async function getContent(): Promise<SiteContent | null> {
  const base = getBaseUrl();
  const url = `${base}/api/content`;

  const res = await fetch(url, {
    // nech sa nikdy neberie z keše
    cache: 'no-store',
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function HomePage() {
  const data = await getContent();

  // Ak by API z nejakého dôvodu vrátilo null/empty, ukážeme „debug“ info
  if (!data) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold mb-2">Načítanie obsahu zlyhalo</h1>
        <p className="text-sm opacity-70">
          API nevrátilo žiadne dáta. Skús obnoviť stránku alebo pozri <code>/api/content</code>.
        </p>
      </main>
    );
  }

  const logoUrl = data.logoUrl ?? null;
  const images = data.carousel ?? [];
  const text = data.text ?? '';

  return (
    <main className="flex flex-col items-center gap-4 p-6">
      {logoUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="logo" className="mx-auto h-16 w-auto" />
        </>
      ) : null}

      {images.length > 0 && <Carousel images={images} />}

      {text ? (
        <article className="prose max-w-none text-base whitespace-pre-wrap">
          {text}
        </article>
      ) : (
        <p className="text-sm opacity-60">Zatiaľ žiadny text.</p>
      )}
    </main>
  );
}
