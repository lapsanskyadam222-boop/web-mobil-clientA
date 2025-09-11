'use client';

import * as React from 'react';
import Image from 'next/image';

type Props = {
  images: string[];
  /** Pomer strán – napr. '4/5', '1/1', '16/9'. Default 4/5. */
  aspect?: string;
  /** Dodatočné className pre obal sekcie (nepovinné). */
  className?: string;
};

function aspectToPaddingPercent(aspect?: string) {
  const raw = (aspect ?? '4/5').replace(/\s/g, '');
  const [w, h] = raw.split('/').map(Number);
  if (!w || !h) return 125; // fallback = 4/5 -> 125 %
  return (h / w) * 100;
}

export default function Carousel({
  images,
  aspect = '4/5',
  className = '',
}: Props) {
  const total = Array.isArray(images) ? images.length : 0;
  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const startX = React.useRef(0);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const widthRef = React.useRef(1);
  const lockRef = React.useRef<'x' | 'y' | null>(null);

  // zmeraj šírku viewportu (na prepočet ťahania v %)
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => (widthRef.current = Math.max(1, el.clientWidth || 1));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const begin = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
    lockRef.current = null;
    setDragging(true);
    setDragX(0);
  };

  const move = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;

    if (!lockRef.current) {
      if (Math.abs(dx) < 6) return; // neblokuj vertikálny scroll pri malom pohybe
      lockRef.current = 'x';
    }
    if (lockRef.current === 'x') {
      e.preventDefault();
      setDragX(dx);
    }
  };

  const end = () => {
    if (!dragging) return;
    const delta = dragX / Math.max(1, widthRef.current);
    let next = index;
    // prah = 1/4 šírky
    if (delta <= -0.25 && index < total - 1) next = index + 1;
    if (delta >= 0.25 && index > 0) next = index - 1;
    setIndex(next);
    setDragX(0);
    setDragging(false);
    lockRef.current = null;
  };

  const tx = -(index * 100) + (dragX / Math.max(1, widthRef.current)) * 100;
  const padTop = aspectToPaddingPercent(aspect);

  if (!total) return null;

  return (
    <section className={className}>
      {/* VIEWPORT */}
      <div
        ref={wrapRef}
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          borderRadius: '8px',
          background: 'rgba(0,0,0,0.05)',
          maxWidth: '960px',     // desktop max šírka
          margin: '0 auto',      // centrovanie na PC
        }}
      >
        {/* TRACK */}
        <div
          style={{
            display: 'flex',
            touchAction: 'pan-y',
            userSelect: 'none',
            transform: `translate3d(${tx}%, 0, 0)`,
            transition: dragging ? 'none' : 'transform 300ms ease',
            willChange: 'transform',
          }}
          onPointerDown={begin}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          aria-label="carousel-track"
        >
          {images.map((src, i) => (
            <div
              key={i}
              style={{ position: 'relative', flex: '0 0 100%', overflow: 'hidden' }}
            >
              {/* ratio-box podľa pomeru */}
              <div style={{ width: '100%', paddingTop: `${padTop}%` }} aria-hidden="true" />
              <div style={{ position: 'absolute', inset: 0 }}>
                <Image
                  src={src}
                  alt={`slide-${i + 1}`}
                  fill
                  style={{
                    objectFit: 'cover',
                    display: 'block',
                    userSelect: 'none',
                  }}
                  priority={i === 0}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 800px, 960px"
                  quality={75}
                  draggable={false}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
