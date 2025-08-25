'use client';

import * as React from 'react';

type Props = {
  images: string[];
  /** Pomer strán: "4/5", "1/1", "16/9"… (default "4/5") */
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

  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const startX = React.useRef(0);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const widthRef = React.useRef(1);
  const lockRef = React.useRef<'x' | 'y' | null>(null);

  // meranie šírky viewportu (kvôli prepočtu drag -> %)
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => (widthRef.current = Math.max(1, el.clientWidth || 0));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // pointer handlers – čisté, bez zásahov do <body>
  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
    lockRef.current = null;
    setDragging(true);
    setDragX(0);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;

    if (!lockRef.current) {
      if (Math.abs(dx) < 8) return;  // kým nie je jasný smer, neblokuj scroll
      lockRef.current = 'x';
    }

    if (lockRef.current === 'x') {
      // kľúčové: necháme si riadiť gesto a stránku „odpojíme“
      e.preventDefault();
      setDragX(dx);
    }
  };

  const onEnd = () => {
    if (!dragging) return;

    const width = Math.max(1, widthRef.current);
    const traveled = Math.abs(dragX) / width;

    let next = index;
    if (traveled >= 0.5) {
      // až keď potiahneš aspoň cez polovicu
      if (dragX < 0 && index < total - 1) next = index + 1; // doľava -> ďalší
      if (dragX > 0 && index > 0)        next = index - 1; // doprava -> späť
    }

    setIndex(next);
    setDragX(0);
    setDragging(false);
    lockRef.current = null;
  };

  // preklad trate
  const tx = -(index * 100) + (dragX / Math.max(1, widthRef.current)) * 100;

  return (
    <section className={`relative ${className}`}>
      {/* VIEWPORT – vždy 1 slide; zabráni „pretiahnutiu“ scrollu */}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-2xl bg-black/5"
        style={{
          aspectRatio: aspect,       // drží stabilnú výšku → žiadne skoky layoutu
          overscrollBehavior: 'contain',
        }}
      >
        {/* TRACK – vypneme default dotykové gestá, aby fungovalo preventDefault() */}
        <div
          className="flex select-none"
          style={{
            touchAction: 'none',
            transform: `translate3d(${tx}%, 0, 0)`,
            transition: dragging ? 'none' : 'transform 320ms cubic-bezier(.22,.61,.36,1)',
            willChange: 'transform',
            height: '100%',
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onEnd}
          onPointerCancel={onEnd}
          onPointerLeave={onEnd}
        >
          {items.map((src, i) => (
            <div
              key={i}
              style={{
                flex: '0 0 100%',
                width: '100%',
                height: '100%',
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

      {/* bodky pod fotkou */}
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
