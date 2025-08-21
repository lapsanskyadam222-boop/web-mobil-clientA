import Carousel from '@/components/Carousel';
import { headers } from 'next/headers';
import type { SiteContent } from '@/lib/types';

async function getBaseUrl(): Promise<string> {
  // funguje v Server Components aj na Verceli
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('x-forwarded-host') ?? h.get('host');

  if (host) return `${proto}://${host}`;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

async function getContent(): Promise<SiteContent | null> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/content`, { cache: 'no-store' });
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
