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
      <main className="mx-auto max-w-screen-sm p-4">
        <h1 className="text-xl font-semibold mb-4">Načítanie obsahu zlyhalo</h1>
        <pre className="text-sm">{result.status ? `HTTP ${result.status}\n` : ''}{result.error ?? ''}</pre>
      </main>
    );
  }

  const data = result.data!;
  const logoUrl = data.logoUrl ?? null;
  const images = Array.isArray(data.carousel) ? data.carousel : [];
  const text = data.text ?? '';

  return (
    <main
      className="min-h-dvh bg-white text-gray-900 antialiased"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
      }}
    >
      {/* LOGO – škálovanie clampom, vycentrované */}
      {logoUrl && (
        <img
          src={logoUrl}
          alt="logo"
          className="mx-auto w-auto"
          style={{
            height: 'clamp(56px, 12vw, 92px)', // pekné responsívne škálovanie
            display: 'block',
          }}
        />
      )}

      {/* CAROUSEL – max šírka 900px, inak 92vw; vždy zaberie celú šírku tohto kontajnera */}
      {images.length > 0 && (
        <div
          className="mx-auto w-full"
          style={{ width: 'min(92vw, 900px)' }}
        >
          <Carousel
            images={images}
            aspect="4/5"       // ako IG post; pokojne zmeň na "1/1" alebo "16/9"
            className="w-full" // nechávame len pre prípad ďalšieho štýlovania
          />
        </div>
      )}

      {/* TEXT */}
      {text ? (
        <article
          className="prose"
          style={{
            textAlign: 'center',
            maxWidth: 'min(92vw, 900px)',
          }}
        >
          {text}
        </article>
      ) : (
        <p className="text-sm" style={{ opacity: 0.6 }}>Zatiaľ žiadny text.</p>
      )}
    </main>
  );
}
