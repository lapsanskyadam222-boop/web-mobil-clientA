'use client';

import * as React from 'react';

type Props = {
  images: string[];
  aspect?: string; // napr. "4/5", "16/9", "1/1"
  className?: string;
};

function aspectToPercent(aspect?: string) {
  const raw = (aspect ?? '4/5').replace(/\s/g, '');
  const [w, h] = raw.split('/').map((n) => Number(n));
  if (!w || !h) return 125;
  return (h / w) * 100;
}

export default function Carousel({ images, aspect = '4/5', className = '' }: Props) {
  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const startX = React.useRef(0);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const widthRef = React.useRef(1);
  const lockRef = React.useRef<'x' | 'y' | null>(null);

  const total = Array.isArray(images) ? images.length : 0;
  if (total === 0) return null;

  // zmeraj šírku
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => (widthRef.current = Math.max(1, el.clientWidth || 0));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // drag
  const beginDrag = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
    lockRef.current = null;
    setDragging(true);
    setDragX(0);
  };

  const moveDrag = (e: React.PointerEvent) => {
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

  const endDrag = () => {
    if (!dragging) return;
    const delta = dragX / Math.max(1, widthRef.current);
    let next = index;
    if (delta <= -0.25 && index < total - 1) next = index + 1;
    if (delta >= 0.25 && index > 0) next = index - 1;
    setIndex(next);
    setDragX(0);
    setDragging(false);
    lockRef.current = null;
  };

  const tx = -(index * 100) + (dragX / Math.max(1, widthRef.current)) * 100;
  const padTop = aspectToPercent(aspect);

  return (
    <section className={`relative w-full ${className}`}>
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-2xl bg-black/5 min-h-[120px]"
      >
        <div
          className="flex touch-pan-y select-none"
          style={{
            transform: `translate3d(${tx}%, 0, 0)`,
            transition: dragging ? 'none' : 'transform 300ms ease',
            willChange: 'transform',
          }}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
        >
          {images.map((src, i) => (
            <div key={i} className="relative basis-full shrink-0 grow-0 overflow-hidden">
              <div style={{ width: '100%', paddingTop: `${padTop}%` }} aria-hidden="true" />
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
    </section>
  );
}
