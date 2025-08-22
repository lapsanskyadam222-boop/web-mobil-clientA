// components/Carousel.tsx
'use client';

import * as React from 'react';

type Props = {
  images: string[];
  /** napr. 'aspect-[4/5]' (IG post), 'aspect-square', 'aspect-video' */
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
  const locked = React.useRef<'x' | 'y' | null>(null);

  const total = images.length;

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const resize = () => {
      widthRef.current = el.clientWidth || 1;
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // --- pointer handlers ---
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
    locked.current = null;
    setDragging(true);
    setDragX(0);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;

    if (!locked.current) {
      if (Math.abs(dx) > 6) locked.current = 'x';
      else return;
    }
    if (locked.current === 'x') {
      e.preventDefault();
      setDragX(dx);
    }
  };

  const onPointerUp = () => {
    if (!dragging) return;
    const w = widthRef.current;
    const delta = dragX / w;

    let next = index;
    if (delta <= -0.15 && index < total - 1) next = index + 1;
    if (delta >= 0.15 && index > 0) next = index - 1;

    setIndex(next);
    setDragX(0);
    setDragging(false);
    locked.current = null;
  };

  // alias → použijeme v JSX
  const endDrag = () => onPointerUp();

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(total - 1, i + 1));

  const tx = -(index * 100) + (dragX / widthRef.current) * 100;

  if (total === 0) return null;

  return (
    <section className={`relative w-full ${className}`}>
      {/* VIEWPORT */}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-2xl bg-black/5"
      >
        {/* TRACK */}
        <div
          className="flex touch-pan-y select-none"
          style={{
            transform: `translate3d(${tx}%, 0, 0)`,
            transition: dragging ? 'none' : 'transform 320ms ease',
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
              className={`relative basis-full shrink-0 grow-0 ${aspectClass}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`slide-${i + 1}`}
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
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
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-40 hidden md:block"
          >
            ‹
          </button>
          <button
            aria-label="Ďalší"
            onClick={goNext}
            disabled={index === total - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-40 hidden md:block"
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
