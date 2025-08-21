import Carousel from '@/components/Carousel';
import type { SiteContent } from '@/lib/types';

async function getContent(): Promise<SiteContent | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const url = `${base}/api/content`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function HomePage() {
  const data = await getContent();

  const logoUrl = data?.logoUrl ?? null;
  const images = data?.carousel ?? [];
  const text = data?.text ?? '';

  return (
    <main className="flex flex-col items-center gap-4">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="logo" className="mx-auto h-16 w-auto" />
      )}

      <Carousel images={images} />

      <article className="prose max-w-none text-base whitespace-pre-wrap">
        {text}
      </article>
    </main>
  );
}
