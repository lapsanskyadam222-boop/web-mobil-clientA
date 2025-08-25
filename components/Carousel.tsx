'use client';

import * as React from 'react';

type Props = {
  images: string[];
  /** Pomer strán: "4/5", "1/1", "16/9"... (default "4/5") */
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

  const [index, setIndex]   = React.useState(0);
  const [dragX, setDragX]   = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const startX    = React.useRef(0);
  const widthRef  = React.useRef(1);
  const wrapRef   = React.useRef<HTMLDivElement | null>(null);
  const lockRef   = React.useRef<'x' | 'y' | null>(null);

  // na čas ťahania úplne zamkneme scroll stránky (funguje aj na iOS)
  const savedScrollY = React.useRef(0);
  React.useEffect(() => {
    if (!dragging) return;
    const body = document.body;
    const doc  = document.documentElement;

    savedScrollY.current = window.scrollY || doc.scrollTop || 0;

    // lock
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY.current}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      // unlock
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      window.scrollTo(0, savedScrollY.current);
    };
  }, [dragging]);

  // merač šírky viewportu pre prepočet drag -> %
  React.useEffect(() => {
    const el = wrapRef.current;
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
      // kým nie je jasný horizontálny smer, nič nezamykáme
      if (Math.abs(dx) < 6) return;
      lockRef.current = 'x';
    }

    if (lockRef.current === 'x') {
      // dôležité: funguje, lebo na tracku nižšie je touch-action:none
      e.preventDefault();
      setDragX(dx);
    }
  };

  const onPointerEnd = () => {
    if (!dragging) return;
    const delta = dragX / Math.max(1, widthRef.current);
    let next = index;
    if (delta <= -0.15 && index < total - 1) next = index + 1;
    if (delta >=  0.15 && index > 0)        next = index - 1;

    setIndex(next);
    setDragX(0);
    setDragging(false);
    lockRef.current = null;
  };

  const goPrev = () => setIndex(i => Math.max(0, i - 1));
  const goNext = () => setIndex(i => Math.min(total - 1, i + 1));

  const tx = -(index * 100) + (dragX / Math.max(1, widthRef.current)) * 100;

  return (
    <section className={`relative ${className}`}>
      {/* VIEWPORT – ukáže vždy 1 slide; zabráň scroll‑chainingu */}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-2xl bg-black/5 overscroll-contain touch-pan-y"
      >
        {/* TRACK – tu vypneme touch gestá pre stránku */}
        <div
          className="flex select-none touch-none"
          style={{
            transform: `translate3d(${tx}%, 0, 0)`,
            transition: dragging ? 'none' : 'transform 300ms ease',
            willChange: 'transform',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={onPointerEnd}
        >
          {items.map((src, i) => (
            <div
              key={i}
              style={{
                flex: '0 0 100%',
                width: '100%',
                aspectRatio: aspect,
                minHeight: 180,
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

      {/* šípky (desktop) */}
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

      {/* bodky */}
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
