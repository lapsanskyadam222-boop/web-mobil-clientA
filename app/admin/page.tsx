'use client';

import { useEffect, useState } from 'react';
import { FileDrop } from '@/components/FileDrop';

type SavePayload = {
  logoUrl: string | null;
  carousel: string[];
  text: string;
};

export default function AdminPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [carousel, setCarousel] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string>('');
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/content', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setLogoUrl(data.logoUrl ?? null);
        setCarousel(Array.isArray(data.carousel) ? data.carousel : []);
        setText(data.text ?? '');
      } catch {}
    })();
  }, []);

  const removeCarouselAt = (idx: number) => {
    setCarousel(prev => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    setBusy(true);
    setOk('');
    setErr('');

    if (carousel.length < 1) {
      setBusy(false);
      setErr('Pridaj aspoň jeden obrázok do carouselu.');
      return;
    }
    if (carousel.length > 10) {
      setBusy(false);
      setErr('Maximálne 10 obrázkov v carousele.');
      return;
    }

    const payload: SavePayload = {
      logoUrl: logoUrl ?? null,
      carousel: [...carousel],
      text: text ?? '',
    };

    try {
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
    <main className="max-w-xl mx-auto py-8 space-y-8">
      <h1 className="text-xl font-semibold">Admin editor</h1>

      {/* Logo */}
      <section className="space-y-3">
        <h2 className="font-medium">Logo (PNG/JPG, ≤10MB)</h2>
        <FileDrop
          label="Pridať logo"
          multiple={false}
          maxPerFileMB={10}
          accept="image/png,image/jpeg"
          onUploaded={(urls) => {
            setLogoUrl(urls[0] ?? null);
          }}
        />
        {logoUrl && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="logo preview" className="h-16 w-auto" />
          </div>
        )}
      </section>

      {/* Carousel */}
      <section className="space-y-3">
        <h2 className="font-medium">Carousel obrázky (1–10 JPG, ≤10MB/ks)</h2>
        <FileDrop
          label="Pridať fotky"
          multiple
          maxPerFileMB={10}
          accept="image/jpeg"
          onUploaded={(urls) => {
            setCarousel((prev) => {
              const next = [...prev, ...urls];
              return next.slice(0, 10);
            });
          }}
        />
        {carousel.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {carousel.map((src, i) => (
              <div key={src + i} className="relative border rounded p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`img-${i + 1}`} className="w-full h-28 object-contain" />
                <button
                  type="button"
                  className="absolute -top-2 -right-2 bg-black text-white text-xs rounded-full px-2 py-1"
                  onClick={() => removeCarouselAt(i)}
                  aria-label={`Odstrániť ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Text */}
      <section className="space-y-2">
        <h2 className="font-medium">Text</h2>
        <textarea
          className="w-full border rounded p-2"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
        />
      </section>

      <div className="space-y-2">
        <button
          onClick={submit}
          disabled={busy}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {busy ? 'Ukladám…' : 'Zverejniť'}
        </button>
        {ok && <p className="text-green-700 text-sm">{ok}</p>}
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <p className="text-xs text-gray-500">
          Zmeny sa okamžite prejavia – homepage ich číta vždy „no-store“.
        </p>
      </div>
    </main>
  );
}
