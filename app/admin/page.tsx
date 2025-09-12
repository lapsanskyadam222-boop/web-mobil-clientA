'use client';

import { useEffect, useState } from 'react';
import { FileDrop } from '@/components/FileDrop';

type SavePayload = {
  logoUrl: string | null;
  carousel: string[];
  text: string;
  theme?: {
    mode: 'light' | 'dark' | 'custom';
    bgColor?: string;
    textColor?: string;
  };
};

export default function AdminPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [carousel, setCarousel] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string>('');
  const [err, setErr] = useState<string>('');

  // téma (predpoklad: toto tu už máš; nechávam kompatibilitu)
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'custom'>('light');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#111111');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/content', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setLogoUrl(data.logoUrl ?? null);
        setCarousel(Array.isArray(data.carousel) ? data.carousel : []);
        setText(data.text ?? '');

        const t = data.theme ?? { mode: 'light' };
        setThemeMode(t.mode);
        if (t.mode === 'custom') {
          if (t.bgColor) setBgColor(t.bgColor);
          if (t.textColor) setTextColor(t.textColor);
        }
      } catch {}
    })();
  }, []);

  const removeCarouselAt = (idx: number) => {
    setCarousel((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    setBusy(true);
    setOk('');
    setErr('');

    if (carousel.length > 10) {
      setBusy(false);
      setErr('Maximálne 10 obrázkov v carousele.');
      return;
    }

    const payload: SavePayload = {
      logoUrl: logoUrl ?? null,
      carousel: [...carousel],
      text: text ?? '',
      theme:
        themeMode === 'custom'
          ? { mode: 'custom', bgColor, textColor }
          : { mode: themeMode },
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

      {/* Logo (povolíme PNG aj JPG) */}
      <section className="space-y-3">
        <h2 className="font-medium">Logo (PNG/JPG, ≤10MB)</h2>
        <FileDrop
          label="Pridať logo"
          multiple={false}
          maxPerFileMB={10}
          accept="image/png,image/jpeg"
          onUploaded={(urls) => setLogoUrl(urls[0] ?? null)}
        />
        {logoUrl && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="logo preview" className="h-16 w-auto" />
          </div>
        )}
      </section>

      {/* Carousel – ponecháme len JPG kvôli váhe */}
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

      {/* Téma (ak už máš vlastný UI, kľudne nechaj svoj) */}
      <section className="space-y-2">
        <h2 className="font-medium">Téma</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              checked={themeMode === 'light'}
              onChange={() => setThemeMode('light')}
            />
            Svetlá
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              checked={themeMode === 'dark'}
              onChange={() => setThemeMode('dark')}
            />
            Tmavá (čierne pozadie)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              checked={themeMode === 'custom'}
              onChange={() => setThemeMode('custom')}
            />
            Vlastná
          </label>

          {themeMode === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                Pozadie
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="block w-full h-10 p-0 border rounded"
                />
              </label>
              <label className="text-sm">
                Text
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="block w-full h-10 p-0 border rounded"
                />
              </label>
            </div>
          )}
        </div>
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
        <p className="text-xs text-gray-500">Zmeny sa prejavia okamžite.</p>
      </div>
    </main>
  );
}
