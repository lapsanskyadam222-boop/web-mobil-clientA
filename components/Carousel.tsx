'use client';

import * as React from 'react';

type Props = {
  images: string[];
  /** Pomer strán, napr. '4/5', '1/1', '16/9'. Default '4/5'. */
  aspect?: string;
  className?: string;
};

function aspectToPercent(aspect?: string) {
  const raw = (aspect ?? '4/5').replace(/\s/g, '');
  const [w, h] = raw.split('/').map(Number);
  if (!w || !h) return 125; // fallback pre 4/5
  return (h / w) * 100;
}

export default function Carousel({ images, aspect = '4/5', className = '' }: Props) {
  const total = Array.isArray(images) ? images.length : 0;
  if (total === 0) return null;

  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const startX = React.useRef(0);
  const viewRef = React.useRef<HTMLDivElement | null>(null);
  const widthRef = React.useRef(1);
  const lockRef = React.useRef<'x' | 'y' | null>(null);

  // zmeranie šírky viewportu
  React.useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = () => (widthRef.current = Math.max(1, el.clientWidth || 0));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // pointer handlers
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
    lockRef.current = null;
    setDragging(true);
    setDragX(0);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;

    if (!lockRef.current) {
      if (Math.abs(dx) < 6) return; // nezamykaj hneď, nech ide zvislý scroll
      lockRef.current = 'x';
    }
    if (lockRef.current === 'x') {
      e.preventDefault();
      setDragX(dx);
    }
  };

  const onPointerEnd = () => {
    if (!dragging) return;
    const w = Math.max(1, widthRef.current);
    const delta = dragX / w;

    let next = index;
    if (delta <= -0.15 && index < total - 1) next = index + 1; // potiahni doľava -> ďalší
    if (delta >= 0.15 && index > 0)        next = index - 1;   // potiahni doprava -> späť

    setIndex(next);
    setDragX(0);
    setDragging(false);
    lockRef.current = null;
  };

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(total - 1, i + 1));

  const padTop = aspectToPercent(aspect);
  const currentSrc = images[index];

  return (
    <section className={`relative w-full ${className}`}>
      {/* VIEWPORT – vždy zobrazí iba 1 slide */}
      <div
        ref={viewRef}
        className="relative w-full overflow-visible"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
      >
        {/* Ratio box drží výšku podľa pomeru strán */}
        <div style={{ width: '100%', paddingTop: `${padTop}%` }} aria-hidden="true" />

        {/* Absolútne vrstvený obsah v rámci vlastného RELATÍVNEHO kontajnera,
            aby nič nepretieklo a neprekrývalo prvky pod karuselom */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="h-full w-full will-change-transform"
            style={{
              transform: `translate3d(${dragX}px, 0, 0)`,
              transition: dragging ? 'none' : 'transform 220ms ease',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentSrc}
              alt={`slide-${index + 1}`}
              className="h-full w-full object-cover block"
              draggable={false}
              loading="eager"
            />
          </div>
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
