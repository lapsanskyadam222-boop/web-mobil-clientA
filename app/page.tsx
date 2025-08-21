import Carousel from '@/components/Carousel';
import type { SiteContent } from '@/lib/types';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

function absUrl(path: string) {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}${path}`;
  // fallback pre build alebo neštandardné prostredie
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}${path}`;
  return `http://localhost:3000${path}`;
}

async function getContent(): Promise<SiteContent | null> {
  const url = absUrl('/api/content');
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
