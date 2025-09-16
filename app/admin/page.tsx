'use client';

import { useEffect, useRef, useState } from 'react';
import { FileDrop } from '@/components/FileDrop';

type SavePayload = {
  logoUrl: string | null;
  carousel: string[];
  text: string; // HTML povolené
};

export default function AdminPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [carousel, setCarousel] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string>('');
  const [err, setErr] = useState<string>('');

  // textarea ref kvôli práci s výberom
  const taRef = useRef<HTMLTextAreaElement | null>(null);

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

  // --- Mini editor: zabalí výber do značiek ---
  function wrapSelection(tagStart: string, tagEnd: string) {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd, value } = ta;

    const hasSelection = selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd;

    if (!hasSelection) {
      // vlož prázdny pár a kurzor posuň medzi ne
      const pre = value.slice(0, selectionStart ?? 0);
      const post = value.slice(selectionEnd ?? 0);
      const next = `${pre}${tagStart}${tagEnd}${post}`;
      setText(next);
      // posun kurzor medzi tagy po rendri
      requestAnimationFrame(() => {
        if (!taRef.current) return;
        const pos = (selectionStart ?? 0) + tagStart.length;
        taRef.current.selectionStart = taRef.current.selectionEnd = pos;
        taRef.current.focus();
      });
      return;
    }

    const start = selectionStart!;
    const end = selectionEnd!;
    const before = value.slice(0, start);
    const middle = value.slice(start, end);
    const after = value.slice(end);
    const next = `${before}${tagStart}${middle}${tagEnd}${after}`;
    setText(next);

    requestAnimationFrame(() => {
      if (!taRef.current) return;
      // vyber zachováme na pôvodnom strede, posunieme o dĺžku tagStart
      const s = start + tagStart.length;
      const e = s + middle.length;
      taRef.current.selectionStart = s;
      taRef.current.selectionEnd = e;
      taRef.current.focus();
    });
  }

  function makeBold() {
    // <strong>…</strong> = hrubé (Manrope 800 sa použije vďaka fontu)
    wrapSelection('<strong>', '</strong>');
  }

  function makeRegular() {
    // tenké = Regular 400 (explicitne štýlom)
    wrapSelection('<span style="font-weight:400">', '</span>');
  }

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
        <h2 className="font-medium">Carousel obrázky (0–10 JPG, ≤10MB/ks)</h2>
        <FileDrop
          label="Pridať fotky"
          multiple
          maxPerFileMB={10}
          accept="image/jpeg"
          onUploaded={(urls) => setCarousel(prev => [...prev, ...urls].slice(0, 10))}
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

      {/* Text + mini-toolbar */}
      <section className="space-y-2">
        <h2 className="font-medium">Text (s formátovaním)</h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={makeBold}
            className="px-2 py-1 border rounded text-sm font-bold"
            title="Hrubé (B)"
          >
            B
          </button>
          <button
            type="button"
            onClick={makeRegular}
            className="px-2 py-1 border rounded text-sm"
            title="Tenké (Regular 400)"
            style={{ fontWeight: 400 }}
          >
            Regular
          </button>
          <span className="text-xs opacity-60 ml-2">
            Vyber text v poli a klikni na tlačidlo.
          </span>
        </div>

        <textarea
          ref={taRef}
          className="w-full border rounded p-2"
          rows={6}
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
        <p className="text-xs text-gray-500">Zmeny sa okamžite prejavia – homepage ich číta vždy „no-store“.</p>
      </div>
    </main>
  );
}
