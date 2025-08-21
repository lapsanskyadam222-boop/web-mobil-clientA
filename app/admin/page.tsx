'use client';

import { useEffect, useState } from 'react';
import { FileDrop } from '@/components/FileDrop';
import type { SiteContent } from '@/lib/types';
import { getBaseUrl } from '@/lib/getBaseUrl';

export default function AdminPage() {
  const [logo, setLogo] = useState<string | null>(null);
  const [carousel, setCarousel] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');

  // Načítanie obsahu po načítaní stránky
  useEffect(() => {
    const base = getBaseUrl(); // v prehliadači "" => relatívne
    fetch(`${base}/api/content`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SiteContent | null) => {
        if (!d) return;
        setLogo(d.logoUrl);
        setCarousel(d.carousel);
        setText(d.text);
      })
      .catch(() => {
        // nechaj ticho – editor sa stále načíta
      });
  }, []);

  function addLogo(urls: string[]) {
    setLogo(urls[0] ?? null);
  }

  function addCarousel(urls: string[]) {
    const newArr = [...carousel, ...urls];
    if (newArr.length > 10) return alert('Max 10 obrázkov.');
    setCarousel(newArr);
  }

  function removeAt(i: number) {
    setCarousel((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function publish() {
    setMessage('');
    if (!logo) return setMessage('Chýba logo');
    if (carousel.length < 1) return setMessage('Pridaj aspoň 1 obrázok');
    if (carousel.length > 10) return setMessage('Max 10 obrázkov');

    const payload: Omit<SiteContent, 'updatedAt'> = {
      logoUrl: logo,
      carousel,
      text
    };

    const base = getBaseUrl(); // "" v prehliadači; absolútna na serveri (ak by sa to volalo)
    const res = await fetch(`${base}/api/save-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) setMessage('Zverejnené ✅');
    else setMessage('Ukladanie zlyhalo');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Admin editor</h1>

      <section className="space-y-2">
        <FileDrop label="Logo (JPG, ≤10MB)" onUploaded={addLogo} multiple={false} />
        {logo && <img src={logo} alt="logo" className="h-16" />}
      </section>

      <section className="space-y-2">
        <FileDrop
          label="Carousel obrázky (1–10 JPG, ≤10MB/ks)"
          onUploaded={addCarousel}
          multiple
        />
        {carousel.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {carousel.map((u, i) => (
              <li key={i} className="relative">
                <img src={u} alt={`img-${i}`} className="w-full h-auto" />
                <button
                  className="absolute top-1 right-1 bg-white/80 px-2 py-1 text-xs rounded"
                  onClick={() => removeAt(i)}
                >
                  X
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <label className="block text-sm font-medium">Text</label>
        <textarea
          className="w-full border rounded p-2 h-40"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </section>

      <button onClick={publish} className="bg-black text-white px-4 py-2 rounded">
        Zverejniť
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
