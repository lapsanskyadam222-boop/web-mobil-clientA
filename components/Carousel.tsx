// components/Carousel.tsx
'use client';

import * as React from 'react';

type Props = {
  images: string[];
  aspectClass?: string;   // napr. 'aspect-[4/5]' (IG post), alebo 'aspect-video', 'aspect-square'
  className?: string;
};

export default function Carousel({
  images,
  aspectClass = 'aspect-[4/5]',
  className = '',
}: Props) {
  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);       // aktuálne ťahanie v px
  const [dragging, setDragging] = React.useState(false);

  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const startXRef = React.useRef(0);
  const lockedRef = React.useRef<'x' | 'y' | null>(null);

  const total = images.length;
  if (!total) return null;

  const canPrev = index > 0;
  const canNext = index < total - 1;

  // --- Helpers -------------------------------------------------
  const snapTo = React.useCallback(
    (to: number) => setIndex(Math.max(0, Math.min(total - 1, to))),
    [total]
  );

  const prev = () => snapTo(index - 1);
  const next = () => snapTo(index + 1);

  // --- Pointer/Touch drag -------------------------------------
  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startXRef.current = e.clientX;
    setDragging(true);
    lockedRef.current = null;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;

    const dx = e.clientX - startXRef.current;

    // lock smeru (x/y) po pár px, aby scroll na stránke neblokoval
    if (!lockedRef.current) {
      if (Math.abs(dx) > 6) lockedRef.current = 'x';
    }
    if (lockedRef.current !== 'x') return;

    setDragX(dx);
  }

  function endDrag() {
    if (!dragging) return;
    const threshold = 60; // koľko px treba potiahnuť na zmenu slidu
    if (dragX <= -threshold && canNext) {
      next();
    } else if (dragX >= threshold && canPrev) {
      prev();
    }
    setDragX(0);
    setDragging(false);
    lockedRef.current = null;
  }

  // --- Klávesy (ľavá/pravá) ----------------------------------
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  // --- ŠTÝLY A LAYOUT -----------------------------------------
  // šírka „slajdu“ = 100% viewportu, track posúvame translateX
  const baseTranslate = -index * 100; // v %
  // dragX prepočítame na % podľa aktuálnej šírky track viewportu
  const dragPercent = (() => {
    const wrap = trackRef.current?.parentElement;
    if (!wrap) return 0;
    const w = wrap.clientWidth || 1;
    return (dragX / w) * 100;
  })();

  return (
    <section
      className={`w-full ${className}`.trim()}
      aria-roledescription="carousel"
    >
      {/* Viewport */}
      <div
        className={`relative w-full overflow-hidden rounded-xl bg-black/3 ${aspectClass}`}
      >
        {/* Track (riadok so slajdmi) */}
        <div
          ref={trackRef}
          className="flex h-full w-full touch-pan-y select-none"
          style={{
            transform: `translateX(calc(${baseTranslate}% + ${dragPercent}%))`,
            transition: dragging ? 'none' : 'transform 300ms ease',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
        >
          {images.map((src, i) => (
            <div
              key={i}
              className="h-full w-full shrink-0 grow-0 basis-full"
              aria-hidden={i !== index}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`slide ${i + 1}`}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
          ))}
        </div>

        {/* Šípky */}
        <button
          type="button"
          aria-label="Predošlý"
          onClick={prev}
          disabled={!canPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-3 py-2 text-white backdrop-blur disabled:opacity-30"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Ďalší"
          onClick={next}
          disabled={!canNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-3 py-2 text-white backdrop-blur disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {/* Bodky */}
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            aria-label={`Prepnúť na ${i + 1}. snímku`}
            onClick={() => setIndex(i)}
            className={`h-2 w-2 rounded-full transition ${
              i === index ? 'bg-neutral-900' : 'bg-neutral-300'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
