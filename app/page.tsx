// app/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Carousel from '@/components/Carousel';
import { SiteContent } from '@/lib/types';
import { getBaseUrlServer } from '@/lib/getBaseUrlServer';

async function getContent(): Promise<{
  ok: boolean;
  data?: SiteContent;
  error?: string;
  status?: number;
}> {
  try {
    const base = getBaseUrlServer();
    const url = `${base}/api/content`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `Fetch ${url} failed with ${res.status}`,
      };
    }

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
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-2 text-xl font-semibold">Načítanie obsahu zlyhalo</h1>
        <p className="mb-2 text-sm opacity-70">
          API nevrátilo žiadne dáta. Skús obnoviť stránku alebo pozri{' '}
          <code>/api/content</code>.
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
  const images = Array.isArray(data.carousel) ? data.carousel : [];
  const text = data.text ?? '';

  return (
    <main className="flex flex-col items-center p-6">
      {/* LOGO */}
      {logoUrl && (
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="logo"
            className="mx-auto w-auto"
            style={{
              height: 'calc(1.21 * 4rem)', // pôvodne h-16 = 4rem -> +21%
              marginTop: 'calc(0.3 * 1.21 * 4rem)', // 30% výšky loga hore
              marginBottom: 'calc(0.3 * 1.21 * 4rem)', // 30% výšky loga dole
            }}
          />
        </div>
      )}

      {/* CAROUSEL */}
      {images.length > 0 && (
        <Carousel
          images={images}
          aspect="4/5" // pomer ako IG
          className="mx-auto w-full max-w-[min(92vw,900px)]"
        />
      )}

      {/* TEXT */}
      {text ? (
        <article className="prose max-w-none text-base whitespace-pre-wrap text-center mt-6">
          {text}
        </article>
      ) : (
        <p className="text-sm opacity-60 mt-6">Zatiaľ žiadny text.</p>
      )}
    </main>
  );
}
