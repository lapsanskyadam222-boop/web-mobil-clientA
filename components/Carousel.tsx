'use client';

import * as React from 'react';
import Image from 'next/image';

type CarouselProps = {
  images: string[];
  /** Pomer strán – napr. "16/9", "4/5", "1/1". Default "16/9". */
  aspect?: string;
  /** Zaoblenie rohov (px). Default 10. */
  radius?: number;
  /** Max. šírka na desktope (px). Default 1200. */
  desktopMaxWidth?: number;
  /** Vnútorné okraje na mobile (px). Default 8. */
  mobilePadding?: number;
  /** Rýchlosť animácie (ms). Default 260. */
  animMs?: number;
  className?: string;
};

function parseAspect(aspect?: string) {
  if (!aspect) return 9 / 16;
  const m = aspect.split('/').map((x) => Number(x.trim()));
  if (m.length === 2 && m.every((n) => Number.isFinite(n) && n > 0)) {
    return m[1] / m[0]; // height/width
  }
  return 9 / 16;
}

export default function Carousel({
  images,
  aspect = '16/9',
  radius = 10,
  desktopMaxWidth = 1200,
  mobilePadding = 8,
  animMs = 260,
  className,
}: CarouselProps) {
  const total = images.length;
  const [index, setIndex] = React.useState(0);

  // track: [prev | current | next], v pokoji posunuté na -100%
  const prevIdx = (index - 1 + total) % total;
  const nextIdx = (index + 1) % total;
  const TRACK_BASE = -100; // %

  // swipe/drag stav
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [deltaX, setDeltaX] = React.useState(0); // px
  const startX = React.useRef(0);
  const lastX = React.useRef(0);
  const lastT = React.useRef(0);
  const velocity = React.useRef(0); // px/ms

  // animácia po uvoľnení (IG-like snap)
  const [animating, setAnimating] = React.useState<false | 'prev' | 'next' | 'stay'>(false);

  // prahy
  const [threshold, setThreshold] = React.useState(100); // v px
  React.useEffect(() => {
    const el = frameRef.current;
    if (el) setThreshold(Math.max(60, el.clientWidth * 0.18));
  }, []);

  // šírka pre výpočet delta → %
  const [widthPx, setWidthPx] = React.useState(0);
  React.useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const r = () => setWidthPx(el.clientWidth);
    r();
    const obs = new ResizeObserver(r);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const pxToPercent = (px: number) => (widthPx ? (px / widthPx) * 100 : 0);

  // gestá (touch/mouse)
  const onStart = (clientX: number) => {
    setAnimating(false);
    setDragging(true);
    startX.current = clientX;
    lastX.current = clientX;
    lastT.current = performance.now();
    velocity.current = 0;
  };

  const onMove = (clientX: number) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = clientX - startX.current;
    const dt = Math.max(16, now - lastT.current);
    velocity.current = (clientX - lastX.current) / dt; // px/ms
    lastX.current = clientX;
    lastT.current = now;
    setDeltaX(dx);
  };

  const onEnd = () => {
    if (!dragging) return;
    setDragging(false);

    const v = velocity.current * 1000; // px/s
    const goNext = deltaX < -threshold || (v < -250 && deltaX < -30);
    const goPrev = deltaX > threshold || (v > 250 && deltaX > 30);

    if (goNext) {
      setAnimating('next');
    } else if (goPrev) {
      setAnimating('prev');
    } else {
      setAnimating('stay');
    }
  };

  // mouse
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onStart(e.clientX);
    const onMoveDoc = (ev: MouseEvent) => onMove(ev.clientX);
    const onUpDoc = () => {
      onEnd();
      document.removeEventListener('mousemove', onMoveDoc);
      document.removeEventListener('mouseup', onUpDoc);
    };
    document.addEventListener('mousemove', onMoveDoc, { passive: true });
    document.addEventListener('mouseup', onUpDoc, { passive: true });
  };

  // touch
  const onTouchStart = (e: React.TouchEvent) => onStart(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => onMove(e.touches[0].clientX);
  const onTouchEnd = () => onEnd();

  // klávesnica (bonus)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setAnimating('next');
      if (e.key === 'ArrowLeft') setAnimating('prev');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // po dokončení animácie „prehoď“ index a resetni track bez viditeľného skoku
  const onTransitionEnd = () => {
    if (animating === 'next') {
      setIndex((i) => (i + 1) % total);
    } else if (animating === 'prev') {
      setIndex((i) => (i - 1 + total) % total);
    }
    setAnimating(false);
    setDeltaX(0);
  };

  if (!total) {
    return (
      <div className="text-center text-sm opacity-60" style={{ padding: '24px 0' }}>
        Zatiaľ žiadne obrázky.
      </div>
    );
  }

  const ratio = parseAspect(aspect);

  // výpočet translate:
  // - v pokoji = -100%
  // - počas ťahania = -100% + deltaX(px→%)
  // - pri animácii:
  //    * 'next' → na -200%
  //    * 'prev' → na 0%
  //    * 'stay' → späť na -100%
  let translatePercent = TRACK_BASE;
  if (dragging) {
    translatePercent = TRACK_BASE + pxToPercent(deltaX);
  } else if (animating === 'next') {
    translatePercent = -200;
  } else if (animating === 'prev') {
    translatePercent = 0;
  } else if (animating === 'stay') {
    translatePercent = TRACK_BASE;
  }

  const trackTransition =
    dragging || animating === false ? 'none' : `transform ${animMs}ms cubic-bezier(.22,.61,.36,1)`; // IG-ish ease-out

  const active = index;

  return (
    <section className={className}>
      <div className="carousel-outer">
        <div
          ref={frameRef}
          className="carousel-frame"
          style={{
            borderRadius: radius,
            overflow: 'hidden',
            position: 'relative',
            width: '100%',
            aspectRatio: aspect,
            height: `min(70vh, ${Math.round(desktopMaxWidth * ratio)}px)`,
            touchAction: 'pan-y',
            userSelect: dragging ? 'none' : 'auto',
            cursor: dragging ? 'grabbing' : 'auto',
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* TRACK = 3 panely vedľa seba */}
          <div
            className="carousel-track"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              gridTemplateColumns: '100% 100% 100%',
              transform: `translateX(${translatePercent}%)`,
              transition: trackTransition,
              willChange: 'transform',
            }}
            onTransitionEnd={onTransitionEnd}
          >
            {/* PREV */}
            <Slide src={images[prevIdx]} alt={`foto-${prevIdx + 1}`} priority={false} />

            {/* CURRENT */}
            <Slide src={images[active]} alt={`foto-${active + 1}`} priority />

            {/* NEXT */}
            <Slide src={images[nextIdx]} alt={`foto-${nextIdx + 1}`} priority={false} />
          </div>
        </div>

        {/* ovládanie (zostáva) */}
        <div className="carousel-controls">
          <button
            className="btn"
            onClick={() => setAnimating('prev')}
            aria-label="Predošlá"
          >
            ‹
          </button>
          <div className="count">
            {active + 1} / {total}
          </div>
          <button
            className="btn"
            onClick={() => setAnimating('next')}
            aria-label="Ďalšia"
          >
            ›
          </button>
        </div>

        {/* body */}
        <div className="dots">
          {images.map((_, i) => (
            <button
              key={i}
              className={`dot ${i === active ? 'dot--active' : ''}`}
              onClick={() => {
                if (i === active) return;
                // pri skoku vzdialenom o 1 použijeme animáciu; inak nastavíme rovno index
                if ((i === (active + 1) % total)) setAnimating('next');
                else if (i === (active - 1 + total) % total) setAnimating('prev');
                else setIndex(i);
              }}
              aria-label={`Snímka ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        .carousel-outer {
          width: 100%;
          max-width: ${desktopMaxWidth}px;
          margin-left: auto;
          margin-right: auto;
        }
        .carousel-controls {
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .btn {
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 12px;
          padding: 6px 10px;
          line-height: 1;
          font-size: 20px;
          background: white;
        }
        .count {
          font-size: 12px;
          opacity: 0.7;
        }
        .dots {
          margin-top: 6px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #d1d5db;
        }
        .dot--active {
          background: #111827;
        }

        @media (max-width: 1023px) {
          .carousel-outer {
            width: 100vw;
            max-width: none;
            margin-left: calc(50% - 50vw);
            margin-right: calc(50% - 50vw);
            padding-left: ${mobilePadding}px;
            padding-right: ${mobilePadding}px;
          }
        }
      `}</style>
    </section>
  );
}

function Slide({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div style={{ position: 'relative' }}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 1000px"
        priority={!!priority}
        style={{ objectFit: 'cover' }}
      />
    </div>
  );
}
