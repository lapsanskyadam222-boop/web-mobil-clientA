// app/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Carousel from '@/components/Carousel';
import { SiteContent } from '@/lib/types';
import { getBaseUrlServer } from '@/lib/getBaseUrlServer';

type ContentResult =
  | { ok: true; data: SiteContent }
  | { ok: false; status?: number; error?: string };

async function getContent(): Promise<ContentResult> {
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
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold mb-2">Načítanie obsahu zlyhalo</h1>
        <p className="text-sm opacity-70 mb-2">
          API nevrátilo žiadne dáta. Skús obnoviť stránku alebo pozri <code>/api/content</code>.
        </p>
        <pre className="text-xs opacity-60 whitespace-pre-wrap">
          {result.status ? `HTTP ${result.status}\n` : ''}
          {result.error ?? ''}
        </pre>
      </main>
    );
  }

  const { logoUrl, carousel = [], text = '' } = result.data;

  return (
    <main className="flex flex-col items-center gap-4 p-6">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="logo" className="mx-auto h-16 w-auto" />
      )}

      {carousel.length > 0 && <Carousel images={carousel} />}

      {text ? (
        <article className="prose max-w-none text-base whitespace-pre-wrap">{text}</article>
      ) : (
        <p className="text-sm opacity-60">Zatiaľ žiadny text.</p>
      )}
    </main>
  );
}
