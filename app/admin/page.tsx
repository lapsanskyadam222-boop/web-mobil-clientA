'use client';

import { useEffect, useState } from 'react';
import { FileDrop } from '@/components/FileDrop';
import type { SiteContent, ThemeConfig } from '@/lib/types';

type SavePayload = {
  logoUrl: string | null;
  carousel: string[];
  text: string;
  theme: ThemeConfig;
};

export default function AdminPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [carousel, setCarousel] = useState<string[]>([]);
  const [text, setText] = useState('');

  // TÉMA (default = light)
  const [themeMode, setThemeMode] = useState<ThemeConfig['mode']>('light');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#111111');

  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string>('');
  const [err, setErr] = useState<string>('');

  // Načítanie existujúceho obsahu (ak je)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/content', { cache: 'no-store' });
        if (!res.ok) return;
        const data: SiteContent = await res.json();

        setLogoUrl(data.logoUrl ?? null);
        setCarousel(Array.isArray(data.carousel) ? data.carousel : []);
        setText(data.text ?? '');

        const th = data.theme;
        if (th?.mode) setThemeMode(th.mode);
        if (th?.bgColor) setBgColor(th.bgColor);
        if (th?.textColor) setTextColor(th.textColor);
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

    // carousel min. 1 a max. 10
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

    // poskladať theme objekt
    const theme: ThemeConfig =
      themeMode === 'custom'
        ? {
            mode: 'custom',
            bgColor: bgColor || '#ffffff',
            textColor: textColor || '#111111',
          }
        : { mode: themeMode };

    const payload: SavePayload = {
      logoUrl: logoUrl ?? null,
      carousel: [...carousel],
      text: text ?? '',
      theme,
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
        <FileDrop
          label="Pridať logo"
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

      {/* Carousel */}
      <section className="space-y-3">
        <h2 className="font-medium">Carousel obrázky (1–10 JPG, ≤10MB/ks)</h2>
        <FileDrop
          label="Pridať fotky"
          multiple
          maxPerFileMB={10}
          accept="image/jpeg"
          onUploaded={(urls) =>
            setCarousel((prev) => [...prev, ...urls].slice(0, 10))
          }
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

      {/* TÉMA */}
      <section className="space-y-3">
        <h2 className="font-medium">Téma vzhľadu</h2>

        <div className="space-y-2">
          <label className="block">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={themeMode === 'light'}
              onChange={() => setThemeMode('light')}
              className="mr-2"
            />
            Light (svetlé pozadie, tmavý text)
          </label>

          <label className="block">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={themeMode === 'dark'}
              onChange={() => setThemeMode('dark')}
              className="mr-2"
            />
            Dark (tmavé pozadie, biely text)
          </label>

          <label className="block">
            <input
              type="radio"
              name="theme"
              value="custom"
              checked={themeMode === 'custom'}
              onChange={() => setThemeMode('custom')}
              className="mr-2"
            />
            Vlastné farby
          </label>
        </div>

        {themeMode === 'custom' && (
          <div className="grid grid-cols-3 gap-2 items-center">
            <span>Farba pozadia</span>
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="col-span-2 h-10 w-20 p-0 border rounded"
            />

            <span>Farba textu</span>
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              className="col-span-2 h-10 w-20 p-0 border rounded"
            />
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
