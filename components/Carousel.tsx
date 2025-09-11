'use client';

import * as React from 'react';

type CarouselProps = {
  images: string[];
  /** Pomer strán, napr. "4/5", "1/1", "16/9". Default: "4/5". */
  aspect?: string;
  /** Jemný rádius (px). Default: 6. */
  edgeRadius?: number;
  /** Max. šírka na desktope (px). Default: 720. */
  desktopMaxWidth?: number;
  /** Vnútorný “gutter” na mobile (px). Default: 12. */
  mobilePadding?: number;
  /** Extra className na sekciu (voliteľné). */
  className?: string;
};

function aspectToPaddingPercent(aspect?: string) {
  const raw = (aspect ?? '4/5').replace(/\s/g, '');
  const [w, h] = raw.split('/').map(Number);
  if (!w || !h) return 125; // fallback 4/5
  return (h / w) * 100;
}

export default function Carousel({
  images,
  aspect = '4/5',
  edgeRadius = 6,
  desktopMaxWidth = 720,
  mobilePadding = 12,
  className = '',
}: CarouselProps) {
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
    const measure = () => {
      widthRef.current = Math.max(1, el.clientWidth || 1);
    };
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
    if (delta <= -0.25 && index < total - 1) next = index + 1;
    if (delta >=  0.25 && index > 0)        next = index - 1;
    setIndex(next);
    setDragX(0);
    setDragging(false);
    lockRef.current = null;
  };

  if (!total) return null;

  const tx = -(index * 100) + (dragX / Math.max(1, widthRef.current)) * 100;
  const padTop = aspectToPaddingPercent(aspect);

  /** Kontajner ktorý:
   * - na mobile má malý “gutter” (mobilePadding) od kraja,
   * - na desktope je centrovaný a limitovaný desktopMaxWidth.
   */
  const outerStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: `${desktopMaxWidth}px`,
    margin: '0 auto',
    paddingLeft: `${mobilePadding}px`,
    paddingRight: `${mobilePadding}px`,
  };

  /** Samotný viewport, edge-to-edge v rámci outeru. */
  const viewportStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    borderRadius: `${edgeRadius}px`,
    background: 'rgba(0,0,0,0.05)',
  };

  const trackStyle: React.CSSProperties = {
    display: 'flex',
    touchAction: 'pan-y',
    userSelect: 'none',
    transform: `translate3d(${tx}%, 0, 0)`,
    transition: dragging ? 'none' : 'transform 300ms ease',
    willChange: 'transform',
  };

  return (
    <section className={className}>
      <div style={outerStyle}>
        <div ref={wrapRef} style={viewportStyle}>
          <div
            style={trackStyle}
            onPointerDown={begin}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerLeave={end}
            aria-label="carousel-track"
          >
            {images.map((src, i) => (
              <div key={i} style={{ position: 'relative', flex: '0 0 100%', overflow: 'hidden' }}>
                <div style={{ width: '100%', paddingTop: `${padTop}%` }} aria-hidden="true" />
                <div style={{ position: 'absolute', inset: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`slide-${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    draggable={false}
                    loading={i === 0 ? 'eager' : 'lazy'}
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
