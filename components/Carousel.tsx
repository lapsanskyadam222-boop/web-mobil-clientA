'use client';

import * as React from 'react';
import Image from 'next/image';

type Props = {
  images: string[];
  aspect?: string;            // napr. '4/5'
  radius?: number;            // jemný rádius, default 6
  desktopMaxWidth?: number;   // cap na desktope (px), default 720
  className?: string;
};

function aspectToPaddingPercent(aspect?: string) {
  const raw = (aspect ?? '4/5').replace(/\s/g, '');
  const [w, h] = raw.split('/').map(Number);
  if (!w || !h) return 125;
  return (h / w) * 100;
}

export default function Carousel({
  images,
  aspect = '4/5',
  radius = 6,
  desktopMaxWidth = 720,
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
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
    lockRef.current = null;
    setDragging(true);
    setDragX(0);
  };

  const move = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;

    if (!lockRef.current) {
      if (Math.abs(dx) < 6) return;
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
    if (delta <= -0.25 && index < total - 1) next = index + 1;
    if (delta >=  0.25 && index > 0)        next = index - 1;
    setIndex(next);
    setDragX(0);
    setDragging(false);
    lockRef.current = null;
  };

  const tx = -(index * 100) + (dragX / Math.max(1, widthRef.current)) * 100;
  const padTop = aspectToPaddingPercent(aspect);

  if (!total) return null;

  const PAD_INLINE = 'clamp(8px, 3vw, 20px)';

  return (
    <section
      className={className}
      style={{
        width: '100vw',
        position: 'relative',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      <div
        style={{
          paddingLeft: PAD_INLINE,
          paddingRight: PAD_INLINE,
          margin: '0 auto',
          maxWidth: `${desktopMaxWidth}px`,
          boxSizing: 'border-box',
        }}
      >
        {/* VIEWPORT — tu sú pointer handlery */}
        <div
          ref={wrapRef}
          onPointerDown={begin}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          style={{
            position: 'relative',
            width: '100%',
            overflow: 'hidden',
            borderRadius: `${radius}px`,
            background: 'rgba(0,0,0,0.05)',
            touchAction: 'pan-y',          // nechá zvislé scrollovanie
            cursor: dragging ? 'grabbing' : 'grab',
          }}
        >
          {/* TRACK */}
          <div
            style={{
              display: 'flex',
              userSelect: 'none',
              transform: `translate3d(${tx}%, 0, 0)`,
              transition: dragging ? 'none' : 'transform 300ms ease',
              willChange: 'transform',
            }}
            aria-label="carousel-track"
          >
            {images.map((src, i) => (
              <div key={i} style={{ position: 'relative', flex: '0 0 100%', overflow: 'hidden' }}>
                <div style={{ width: '100%', paddingTop: `${padTop}%` }} aria-hidden="true" />
                <div style={{ position: 'absolute', inset: 0 }}>
                  <Image
                    src={src}
                    alt={`slide-${i + 1}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 720px"
                    priority={i === 0}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    placeholder="empty"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
