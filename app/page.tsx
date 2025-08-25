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
      return { ok: false, status: res.status, error: `Fetch ${url} failed with ${res.status}` };
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
      <main className="min-h-dvh bg-white text-gray-900 antialiased mx-auto max-w-screen-sm p-4">
        <h1 className="text-xl font-semibold mb-4">Načítanie obsahu zlyhalo</h1>
        <p className="text-sm mb-4">
          API nevrátilo žiadne dáta. Skús obnoviť stránku alebo pozri <code>/api/content</code>.
        </p>
        <pre className="text-sm border rounded p-4">{result.status ? `HTTP ${result.status}\n` : ''}{result.error ?? ''}</pre>
      </main>
    );
  }

  const data = result.data!;
  const logoUrl = data.logoUrl ?? null;
  const images = Array.isArray(data.carousel) ? data.carousel : [];
  const text = data.text ?? '';

  return (
    <main className="min-h-dvh bg-white text-gray-900 antialiased flex flex-col items-center gap-4 p-4">
      {/* LOGO */}
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt="logo"
          className="mx-auto w-auto"
          /* responzívna výška loga – väčšie na mobile, stále centrované */
          style={{ height: 'clamp(88px, 14vw, 140px)' }}
        />
      )}

      {/* CAROUSEL – šírka sa prispôsobí obrazovke, výška drží pomer 4/5 */}
      {images.length > 0 && (
        <div className="mx-auto w-full" style={{ maxWidth: 'min(92vw, 900px)' }}>
          <Carousel
            images={images}
            aspect="4/5"
            className="w-full"
          />
        </div>
      )}

      {/* TEXT */}
      {text ? (
        <article className="prose mx-auto max-w-screen-sm" style={{ textAlign: 'center' }}>
          {text}
        </article>
      ) : (
        <p className="text-sm" style={{ opacity: 0.6 }}>Zatiaľ žiadny text.</p>
      )}
    </main>
  );
}
