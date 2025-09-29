'use client';

import * as React from 'react';
import Image from 'next/image';

type CarouselProps = {
  images: string[];
  /** Pomer strán – napr. "4/5", "1/1", "16/9". */
  aspect?: string;
  /** Jemný rádius rohov v px (default 6). */
  edgeRadius?: number;
  /** Max. šírka na desktope (px) — desktop bude vždy centrovaný. */
  desktopMaxWidth?: number;
  /** Mobilný vnútorný “gutter” v px (default 8). */
  mobilePadding?: number;
  className?: string;
};

function parseAspect(aspect?: string) {
  if (!aspect) return 9 / 16;
  const m = aspect.split('/').map((x) => Number(x.trim()));
  if (m.length === 2 && m.every((n) => Number.isFinite(n) && n > 0)) {
    return m[1] / m[0];
  }
  return 9 / 16;
}

export default function Carousel({
  images,
  aspect = '16/9',
  edgeRadius = 6,
  desktopMaxWidth = 1200,
  mobilePadding = 8,
  className,
}: CarouselProps) {
  const [index, setIndex] = React.useState(0);
  const total = images.length;
  const ratio = parseAspect(aspect);

  // zobrazujeme len aktívny + susedov, aby sa neťahali všetky naraz
  const visible = React.useMemo(() => {
    if (total === 0) return new Set<number>();
    const prev = (index - 1 + total) % total;
    const next = (index + 1) % total;
    return new Set([prev, index, next]);
  }, [index, total]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % total);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + total) % total);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  if (!total) {
    return (
      <div className="text-center text-sm opacity-60" style={{ padding: '24px 0' }}>
        Zatiaľ žiadne obrázky.
      </div>
    );
  }

  return (
    <section className={className}>
      <div className="carousel-outer">
        <div
          className="carousel-frame"
          style={{
            borderRadius: edgeRadius,
            overflow: 'hidden',
            position: 'relative',
            width: '100%',
            // aspect-ratio nie je podporené v starších prehliadačoch, ale nám stačí moderné:
            aspectRatio: aspect,
            // fallback výška pre prípad, že by prehliadač aspect-ratio ignoroval
            height: `min(70vh, ${Math.round(desktopMaxWidth * ratio)}px)`,
          }}
        >
          {images.map((src, i) => {
            const show = visible.has(i);
            const active = i === index;
            return (
              <div
                key={i}
                className="slide"
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: active ? 1 : 0,
                  transition: 'opacity 220ms ease',
                  pointerEvents: active ? 'auto' : 'none',
                }}
                aria-hidden={!active}
              >
                {show && (
                  <Image
                    src={src}
                    alt={`foto-${i + 1}`}
                    fill
                    // nech Next/Image vyberie vhodnú veľkosť
                    sizes="(max-width: 768px) 100vw, 1000px"
                    priority={active} // aktívny nech ide hneď, susedia budú lazy
                    style={{ objectFit: 'cover' }}
                    // NOTE: žiadne manuálne farby/štýly, nech optimalizuje Next
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="carousel-controls">
          <button
            className="btn"
            onClick={() => setIndex((i) => (i - 1 + total) % total)}
            aria-label="Predošlá fotka"
          >
            ‹
          </button>
          <div className="count">
            {index + 1} / {total}
          </div>
          <button
            className="btn"
            onClick={() => setIndex((i) => (i + 1) % total)}
            aria-label="Ďalšia fotka"
          >
            ›
          </button>
        </div>

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
