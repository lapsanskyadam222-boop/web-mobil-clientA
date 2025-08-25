'use client';

import * as React from 'react';

type Props = {
  images: string[];
  /** Pomer strán: "4/5", "1/1", "16/9"… (default "4/5") */
  aspect?: string;
  className?: string;
};

export default function Carousel({
  images,
  aspect = '4/5',
  className = '',
}: Props) {
  const items = Array.isArray(images) ? images.filter(Boolean) : [];
  const total = items.length;
  if (total === 0) return null;

  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const startX   = React.useRef(0);
  const wrapRef  = React.useRef<HTMLDivElement | null>(null);
  const widthRef = React.useRef(1);
  const lockRef  = React.useRef<'x' | 'y' | null>(null);

  // merač šírky viewportu (na prepočet percent)
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => (widthRef.current = Math.max(1, el.clientWidth || 0));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // začiatok ťahu
  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
    lockRef.current = null;
    setDragging(true);
    setDragX(0);
  };

  // pohyb
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;

    if (!lockRef.current) {
      if (Math.abs(dx) < 6) return; // ignoruj drobné pohyby, nech sa môže stránka vertikálne scrollovať
      lockRef.current = 'x';
    }
    if (lockRef.current === 'x') {
      e.preventDefault();           // drž gesto pre carousel
      setDragX(dx);
    }
  };

  // koniec ťahu (prahová 1/3 šírky)
  const onEnd = () => {
    if (!dragging) return;
    const width = Math.max(1, widthRef.current);
    const traveled = Math.abs(dragX) / width;

    let next = index;
    if (traveled >= 0.33) {
      if (dragX < 0 && index < total - 1) next = index + 1; // doľava -> ďalší
      if (dragX > 0 && index > 0)        next = index - 1; // doprava -> späť
    }

    setIndex(next);
    setDragX(0);
    setDragging(false);
    lockRef.current = null;
  };

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(total - 1, i + 1));

  const tx = -(index * 100) + (dragX / Math.max(1, widthRef.current)) * 100;

  return (
    <section className={`relative w-full ${className}`}>
      {/* VIEWPORT – výšku drží aspect-ratio, overflow skryje ďalšie slidy */}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-2xl bg-black/5"
        style={{
          aspectRatio: aspect,
          overscrollBehavior: 'contain',
        }}
      >
        {/* TRACK – 100% výšky viewportu, touch-action vypnuté */}
        <div
          className="flex select-none"
          style={{
            touchAction: 'none',
            height: '100%',
            transform: `translate3d(${tx}%, 0, 0)`,
            transition: dragging ? 'none' : 'transform 280ms cubic-bezier(.22,.61,.36,1)',
            willChange: 'transform',
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onEnd}
          onPointerCancel={onEnd}
          onPointerLeave={onEnd}
        >
          {items.map((src, i) => (
            <div
              key={i}
              style={{
                flex: '0 0 100%',
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
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

      {/* ŠÍPKY (desktop) */}
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
          {items.map((_, i) => (
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
