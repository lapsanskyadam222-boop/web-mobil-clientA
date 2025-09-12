'use client';

import { useEffect, useState } from 'react';
import { FileDrop } from '@/components/FileDrop';
import type { SiteContent } from '@/lib/types';

type SavePayload = SiteContent;

export default function AdminPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // nový model
  const [hero, setHero] = useState<string[]>([]);
  const [heroText, setHeroText] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [bodyText, setBodyText] = useState('');

  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/content', { cache: 'no-store' });
        if (!res.ok) return;
        const d = (await res.json()) as SiteContent;
        setLogoUrl(d.logoUrl ?? null);
        setHero(Array.isArray(d.hero) ? d.hero : []);
        setHeroText(d.heroText ?? '');
        setGallery(Array.isArray(d.gallery) ? d.gallery : []);
        setBodyText(d.bodyText ?? '');
      } catch {}
    })();
  }, []);

  const limit10 = (arr: string[]) =>
    Array.from(new Set(arr.filter(Boolean).map(String))).slice(0, 10);

  const removeAt = (setter: (v: string[]) => void, arr: string[], idx: number) =>
    setter(arr.filter((_, i) => i !== idx));

  const save = async () => {
    setBusy(true); setOk(''); setErr('');

    try {
      const payload: SavePayload = {
        logoUrl,
        hero: limit10(hero),
        heroText: heroText ?? '',
        gallery: limit10(gallery),
        bodyText: bodyText ?? '',
      };

      const res = await fetch('/api/save-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Ukladanie zlyhalo');
      }
      setOk('Zverejnené ✅');
    } catch (e: any) {
      setErr(e?.message || 'Ukladanie zlyhalo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-xl mx-auto py-8 space-y-10">
      <h1 className="text-xl font-semibold">Admin editor</h1>

      {/* LOGO */}
      <section className="space-y-3">
        <h2 className="font-medium">Logo (JPG, ≤10MB)</h2>
        <FileDrop
          label="Presuň sem JPG alebo klikni na výber."
          multiple={false}
          maxPerFileMB={10}
          accept="image/jpeg"
          onUploaded={(urls) => setLogoUrl(urls[0] ?? null)}
        />
        {logoUrl && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="logo preview" className="h-16 w-auto" />
          </div>
        )}
      </section>

      {/* CAROUSEL #1 */}
      <section className="space-y-3">
        <h2 className="font-medium">Carousel #1 (0–10 JPG, ≤10MB/ks)</h2>
        <FileDrop
          label="Presuň sem JPG alebo klikni na výber."
          multiple
          maxPerFileMB={10}
          accept="image/jpeg"
          onUploaded={(urls) => setHero((prev) => limit10([...prev, ...urls]))}
        />
        {hero.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {hero.map((src, i) => (
              <div key={src + i} className="relative border rounded p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`hero-${i + 1}`} className="w-full h-28 object-contain" />
                <button
                  type="button"
                  className="absolute -top-2 -right-2 bg-black text-white text-xs rounded-full px-2 py-1"
                  onClick={() => removeAt(setHero, hero, i)}
                  aria-label={`Odstrániť ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          className="w-full border rounded p-2"
          rows={3}
          placeholder="Text pod 1. carouselom"
          value={heroText}
          onChange={(e) => setHeroText(e.target.value)}
          maxLength={5000}
        />
      </section>

      {/* CAROUSEL #2 */}
      <section className="space-y-3">
        <h2 className="font-medium">Carousel #2 (0–10 JPG, ≤10MB/ks)</h2>
        <FileDrop
          label="Presuň sem JPG alebo klikni na výber."
          multiple
          maxPerFileMB={10}
          accept="image/jpeg"
          onUploaded={(urls) => setGallery((prev) => limit10([...prev, ...urls]))}
        />
        {gallery.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {gallery.map((src, i) => (
              <div key={src + i} className="relative border rounded p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`gallery-${i + 1}`} className="w-full h-28 object-contain" />
                <button
                  type="button"
                  className="absolute -top-2 -right-2 bg-black text-white text-xs rounded-full px-2 py-1"
                  onClick={() => removeAt(setGallery, gallery, i)}
                  aria-label={`Odstrániť ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          className="w-full border rounded p-2"
          rows={3}
          placeholder="Text pod 2. carouselom"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          maxLength={5000}
        />
      </section>

      {/* AKCIE */}
      <div className="space-y-2">
        <button
          onClick={save}
          disabled={busy}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {busy ? 'Ukladám…' : 'Zverejniť'}
        </button>
        {ok && <p className="text-green-700 text-sm">{ok}</p>}
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <p className="text-xs text-gray-500">
          Zmeny sa prejavia okamžite – homepage číta obsah s <code>no-store</code>.
        </p>
      </div>
    </main>
  );
}
