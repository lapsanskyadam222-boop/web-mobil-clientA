'use client';

import * as React from 'react';

type Props = {
  images: string[];
  /** Zvoľ si pomer strán podobný IG postu (4:5). Zmeň podľa potreby. */
  aspectClass?: string; // napr. 'aspect-[4/5]' | 'aspect-square' | 'aspect-video'
  className?: string;
};

export default function Carousel({
  images,
  aspectClass = 'aspect-[4/5]',
  className = '',
}: Props) {
  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0); // aktuálne ťahanie v px
  const [dragging, setDragging] = React.useState(false);
  const startX = React.useRef(0);
  const startY = React.useRef(0);
  const lastX = React.useRef(0);
  const startT = React.useRef(0);
  const locked = React.useRef<null | 'x' | 'y'>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const total = images?.length ?? 0;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  // Bez obrázkov neukazuj nič
  if (!total) return null;

  // --- helpery ---
  const clampIndex = (i: number) => Math.max(0, Math.min(total - 1, i));

  const goto = React.useCallback(
    (i: number) => {
      setIndex(clampIndex(i));
      setDragX(0);
      setDragging(false);
      locked.current = null;
    },
    [total]
  );

  // --- pointer events (touch + myš) jednotne ---
  const onPointerDown = (e: React.PointerEvent) => {
    // iba ľavé tlačidlo (alebo touch)
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    startX.current = e.clientX;
    startY.current = e.clientY;
    lastX.current = e.clientX;
    startT.current = performance.now();
    locked.current = null;
    setDragging(true);
    setDragX(0);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    // Rozlíš smer až keď je posun trochu väčší (aby si nechal normálne vert. scrollovať)
    if (!locked.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        locked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
    }

    // ak používateľ scrolluje vertikálne, nevstupujeme do toho
    if (locked.current === 'y') return;

    e.preventDefault(); // zablokuj horizontálny scroll stránky pri swipovaní
    lastX.current = e.clientX;

    // na začiatku/konci daj „guma“ efekt (menší posun)
    const atEdge =
      (index === 0 && dx > 0) || (index === total - 1 && dx < 0);
    const softened = atEdge ? dx * 0.35 : dx;

    setDragX(softened);
  };

  const onPointerUp = (_e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = lastX.current - startX.current;
    const dt = Math.max(1, performance.now() - startT.current);
    const velocity = dx / dt; // px/ms (záporné doľava)

    const threshold = 60; // koľko px stačí na preklik
    const fast = Math.abs(velocity) > 0.5; // rýchly „flick“

    let next = index;

    if (locked.current !== 'y') {
      if (dx <= -threshold || (fast && dx < 0)) {
        // potiahol doľava -> ďalší
        if (canNext) next = index + 1;
      } else if (dx >= threshold || (fast && dx > 0)) {
        // potiahol doprava -> predchádzajúci
        if (canPrev) next = index - 1;
      }
    }

    goto(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (canPrev) goto(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (canNext) goto(index + 1);
    }
  };

  // výpočet transformácie: aktuálny index + drag
  const translate = `translateX(calc(${-index * 100}% + ${dragX}px))`;
  const transition = dragging ? 'none' : 'transform 300ms cubic-bezier(.2,.8,.2,1)';

  return (
    <div
      ref={containerRef}
      className={`relative w-full select-none ${className}`}
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="Galéria obrázkov"
    >
      {/* zobrazenie 1 fotky v zvolenom pomere strán */}
      <div
        className={`w-full ${aspectClass} overflow-hidden rounded-xl bg-neutral-100`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="h-full w-full flex"
          style={{
            transform: translate,
            transition,
            touchAction: 'pan-y', // necháme vertikálny scroll
          }}
        >
          {images.map((src, i) => (
            <div key={i} className="shrink-0 basis-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`obrázok ${i + 1} z ${total}`}
                className="block h-full w-full object-cover pointer-events-none"
                loading={i <= 1 ? 'eager' : 'lazy'}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* šípky (desktop) */}
      <button
        type="button"
        aria-label="Predchádzajúca fotka"
        onClick={() => canPrev && goto(index - 1)}
        disabled={!canPrev}
        className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-30"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Ďalšia fotka"
        onClick={() => canNext && goto(index + 1)}
        disabled={!canNext}
        className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-30"
      >
        ›
      </button>

      {/* „instagramové“ bodky */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
        {images.map((_, i) => (
          <span
            key={i}
            className={`h-1 w-1 rounded-full ${
              i === index ? 'bg-white' : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
