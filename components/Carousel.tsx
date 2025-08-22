// components/Carousel.tsx
'use client';

import * as React from 'react';

type Props = {
  images: string[];
  /** IG pomer: 'aspect-[4/5]'. Dá sa zmeniť na 'aspect-square' alebo 'aspect-video'. */
  aspectClass?: string;
  className?: string;
};

export default function Carousel({
  images,
  aspectClass = 'aspect-[4/5]',
  className = '',
}: Props) {
  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const startX = React.useRef(0);
  const widthRef = React.useRef(1);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const lockRef = React.useRef<'x' | 'y' | null>(null);

  const total = images.length;
  if (total === 0) return null;

  // vždy drž šírku viewportu, aby každý slide mal presne 100 % a bol viditeľný len jeden
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => (widthRef.current = Math.max(1, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- drag/swipe handlers
  const beginDrag = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
    lockRef.current = null;
    setDragging(true);
    setDragX(0);
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;

    // uzamkni smer na X až keď je pohyb citeľný (neblokuj vert. scroll)
    if (!lockRef.current) {
      if (Math.abs(dx) < 6) return;
      lockRef.current = 'x';
    }
    if (lockRef.current === 'x') {
      e.preventDefault();
      setDragX(dx);
    }
  };

  const endDrag = () => {
    if (!dragging) return;
    const w = widthRef.current;
    const delta = dragX / w;

    let next = index;
    if (delta <= -0.15 && index < total - 1) next = index + 1; // doľava → ďalší
    if (delta >= 0.15 && index > 0)        next = index - 1;   // doprava → späť

    setIndex(next);
    setDragX(0);
    setDragging(false);
    lockRef.current = null;
  };

  const goPrev = () => setIndex(i => Math.max(0, i - 1));
  const goNext = () => setIndex(i => Math.min(total - 1, i + 1));

  // posun trate v %
  const tx = -(index * 100) + (dragX / widthRef.current) * 100;

  return (
    <section className={`relative ${className}`}>
      {/* VIEWPORT – práve toto zabezpečí, že je viditeľný vždy len jeden slide */}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-2xl bg-black/5"
      >
        {/* TRACK */}
        <div
          className="flex touch-pan-y select-none"
          style={{
            transform: `translate3d(${tx}%, 0, 0)`,
            transition: dragging ? 'none' : 'transform 300ms ease',
          }}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
        >
          {images.map((src, i) => (
            <div key={i} className={`relative basis-full shrink-0 grow-0 ${aspectClass}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`slide-${i + 1}`}
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Šípky (desktop) */}
      {total > 1 && (
        <>
          <button
            aria-label="Predchádzajúci"
            onClick={goPrev}
            disabled={index === 0}
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-40 md:block"
          >
            ‹
          </button>
          <button
            aria-label="Ďalší"
            onClick={goNext}
            disabled={index === total - 1}
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-40 md:block"
          >
            ›
          </button>
        </>
      )}

      {/* Bodky */}
      {total > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Prejsť na ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-black/80' : 'w-2 bg-black/30'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
