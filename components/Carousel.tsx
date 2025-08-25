'use client';

import * as React from 'react';

type Props = {
  images: string[];
  /** Pomer strán (napr. "4/5", "1/1", "16/9"). Default 4/5. */
  aspect?: string;
  className?: string;
};

function aspectToPercent(aspect?: string) {
  const raw = (aspect ?? '4/5').replace(/\s/g, '');
  const [w, h] = raw.split('/').map((n) => Number(n));
  if (!w || !h) return 125;
  return (h / w) * 100;
}

export default function Carousel({
  images,
  aspect = '4/5',
  className = '',
}: Props) {
  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const startX = React.useRef(0);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const widthRef = React.useRef(1);
  const lockRef = React.useRef<'x' | 'y' | null>(null);

  const total = Array.isArray(images) ? images.length : 0;
  if (total === 0) return null;

  // zmeraj šírku viewportu
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => (widthRef.current = Math.max(1, el.clientWidth || 0));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // drag start
  const onStart = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
    lockRef.current = null;
    setDragging(true);
    setDragX(0);
  };

  // drag move
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;

    if (!lockRef.current) {
      if (Math.abs(dx) < 6) return; // ignoruj malé pohyby
      lockRef.current = 'x';
    }
    if (lockRef.current === 'x') {
      e.preventDefault();
      setDragX(dx);
    }
  };

  // drag end
  const onEnd = () => {
    if (!dragging) return;
    const width = Math.max(1, widthRef.current);
    const traveled = Math.abs(dragX) / width;

    let next = index;
    if (traveled >= 0.33) { // ← posun už pri tretine
      if (dragX < 0 && index < total - 1) next = index + 1;
      if (dragX > 0 && index > 0)        next = index - 1;
    }

    setIndex(next);
    setDragX(0);
    setDragging(false);
    lockRef.current = null;
  };

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(total - 1, i + 1));

  const tx = -(index * 100) + (dragX / Math.max(1, widthRef.current)) * 100;
  const padTop = aspectToPercent(aspect);

  return (
    <section className={`relative w-full ${className}`}>
      {/* VIEWPORT */}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-2xl bg-black/5 min-h-[120px]"
      >
        {/* TRACK */}
        <div
          className="flex touch-pan-y select-none"
          style={{
            transform: `translate3d(${tx}%, 0, 0)`,
            transition: dragging
              ? 'none'
              : 'transform 280ms cubic-bezier(.22,.61,.36,1)', // svižnejšie
            willChange: 'transform',
          }}
          onPointerDown={onStart}
          onPointerMove={onMove}
          onPointerUp={onEnd}
          onPointerCancel={onEnd}
          onPointerLeave={onEnd}
        >
          {images.map((src, i) => (
            <div key={i} className="relative basis-full shrink-0 grow-0 overflow-hidden">
              {/* ratio box */}
              <div style={{ width: '100%', paddingTop: `${padTop}%` }} aria-hidden="true" />
              {/* obsah */}
              <div className="absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`slide-${i + 1}`}
                  className="h-full w-full object-cover"
                  draggable={false}
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ŠÍPKY */}
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

      {/* BODKY */}
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
