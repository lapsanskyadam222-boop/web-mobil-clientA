'use client';

import * as React from 'react';
import Image from 'next/image';

type CarouselProps = {
  images: string[];
  /** Alias z minulosti: ak zadáš `aspect`, použije sa ako `frameAspect`. */
  aspect?: string;
  /** Pomer rámu (kvôli stabilnému layoutu), napr. "16/9", "4/5", "1/1". */
  frameAspect?: string;
  /** Max. šírka na desktope (px). */
  desktopMaxWidth?: number;
  /** Zaoblenie rohov rámu (px). */
  radius?: number;
  /** Vnútorné okraje na mobile (px). */
  mobilePadding?: number;
  /** Rýchlosť snap animácie (ms). */
  animMs?: number;
  /** Ako vykresliť fotku vo vnútri rámu: "contain" (bez orezania) alebo "cover". */
  fit?: 'contain' | 'cover';
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
  aspect, // alias
  frameAspect = '16/9',
  desktopMaxWidth = 1200,
  radius = 10,
  mobilePadding = 8,
  animMs = 260,
  fit = 'contain', // default bez orezania
  className,
}: CarouselProps) {
  const resolvedAspect = aspect || frameAspect;

  const total = images.length;
  const [index, setIndex] = React.useState(0);

  const prevIdx = (index - 1 + total) % total;
  const nextIdx = (index + 1) % total;

  // --- Pointer Events (mobil aj PC) ---
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const activePointerId = React.useRef<number | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [deltaX, setDeltaX] = React.useState(0);
  const startX = React.useRef(0);
  const lastX = React.useRef(0);
  const lastT = React.useRef(0);
  const velocity = React.useRef(0); // px/ms
  const [animating, setAnimating] = React.useState<false | 'prev' | 'next' | 'stay'>(false);

  const [threshold, setThreshold] = React.useState(100);
  const [widthPx, setWidthPx] = React.useState(0);
  React.useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onResize = () => {
      const w = el.clientWidth;
      setWidthPx(w);
      setThreshold(Math.max(60, w * 0.18));
    };
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pxToPercent = (px: number) => (widthPx ? (px / widthPx) * 100 : 0);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();

    setAnimating(false);
    setDragging(true);
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    velocity.current = 0;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || activePointerId.current !== e.pointerId) return;
    const now = performance.now();
    const dx = e.clientX - startX.current;
    const dt = Math.max(16, now - lastT.current);
    velocity.current = (e.clientX - lastX.current) / dt; // px/ms
    lastX.current = e.clientX;
    lastT.current = now;
    setDeltaX(dx);
  };
  const finishGesture = () => {
    if (!dragging) return;
    setDragging(false);
    const v = velocity.current * 1000; // px/s
    const goNext = deltaX < -threshold || (v < -250 && deltaX < -30);
    const goPrev = deltaX > threshold || (v > 250 && deltaX > 30);
    if (goNext) setAnimating('next');
    else if (goPrev) setAnimating('prev');
    else setAnimating('stay');
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    activePointerId.current = null;
    finishGesture();
  };
  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    activePointerId.current = null;
    finishGesture();
  };

  // klávesnica (voliteľne)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setAnimating('next');
      if (e.key === 'ArrowLeft') setAnimating('prev');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onTransitionEnd = () => {
    if (animating === 'next') setIndex((i) => (i + 1) % total);
    else if (animating === 'prev') setIndex((i) => (i - 1 + total) % total);
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

  // IG-like prepojené posúvanie
  const TRACK_BASE = -100; // %
  let translatePercent = TRACK_BASE;
  if (dragging) translatePercent = TRACK_BASE + pxToPercent(deltaX);
  else if (animating === 'next') translatePercent = -200;
  else if (animating === 'prev') translatePercent = 0;
  else if (animating === 'stay') translatePercent = TRACK_BASE;

  const trackTransition =
    dragging || animating === false ? 'none' : `transform ${animMs}ms cubic-bezier(.22,.61,.36,1)`;

  const ratio = parseAspect(resolvedAspect);

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
            aspectRatio: resolvedAspect,
            height: `min(70vh, ${Math.round(desktopMaxWidth * ratio)}px)`,
            touchAction: 'pan-y',
            userSelect: dragging ? 'none' : 'auto',
            cursor: dragging ? 'grabbing' : 'grab',
            background: fit === 'contain' ? '#0f0f0f' : undefined, // letterbox pre contain
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onDragStart={(e) => e.preventDefault()}
        >
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
            <Slide src={images[prevIdx]} alt={`foto-${prevIdx + 1}`} fit={fit} />
            <Slide src={images[index]} alt={`foto-${index + 1}`} fit={fit} priority />
            <Slide src={images[nextIdx]} alt={`foto-${nextIdx + 1}`} fit={fit} />
          </div>
        </div>

        {/* bodky (bez šípok) */}
        <div className="dots">
          {images.map((_, i) => (
            <button
              key={i}
              className={`dot ${i === index ? 'dot--active' : ''}`}
              onClick={() => setIndex(i)}
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
        .dots {
          margin-top: 8px;
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
          background: #ffffff;
          outline: 2px solid #111827;
          outline-offset: 2px;
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

function Slide({
  src,
  alt,
  fit,
  priority,
}: {
  src: string;
  alt: string;
  fit: 'contain' | 'cover';
  priority?: boolean;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 1000px"
        priority={!!priority}
        style={{ objectFit: fit, userSelect: 'none' }}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}
