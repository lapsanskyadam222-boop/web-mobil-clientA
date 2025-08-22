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
    if (!res.ok)
      return { ok: false, status: res.status, error: `Fetch ${url} failed with ${res.status}` };
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
  const images = Array.isArray(data.carousel) ? data.carousel : [];
  const text = data.text ?? '';

  return (
    <main className="flex flex-col items-center gap-4 p-6">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="logo" className="mx-auto h-16 w-auto" />
      ) : null}

      {/* DEBUG badge – dočasne, nechajme zatiaľ */}
      <div className="text-xs opacity-50">
        images: <code>{JSON.stringify(images.slice(0, 2))} (len={images.length})</code>
      </div>

      {images.length > 0 && (
        <Carousel
          images={images}
          aspect="4 / 5"                                  // IG post
          className="mx-auto w-full max-w-[min(92vw,900px)]"
        />
      )}

      {text ? (
        <article className="prose max-w-none text-base whitespace-pre-wrap">{text}</article>
      ) : (
        <p className="text-sm opacity-60">Zatiaľ žiadny text.</p>
      )}
    </main>
  );
}
