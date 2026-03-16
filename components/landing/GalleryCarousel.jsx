'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';

export function GalleryCarousel({ items }) {
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  function updateScrollState() {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
    // detect active dot
    const cardWidth = el.scrollWidth / items.length;
    setActiveIndex(Math.round(el.scrollLeft / cardWidth));
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    return () => el.removeEventListener('scroll', updateScrollState);
  }, []);

  function scrollBy(dir) {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / items.length;
    el.scrollBy({ left: dir * cardWidth, behavior: 'smooth' });
  }

  function scrollTo(index) {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / items.length;
    el.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-5 overflow-x-auto pb-2 scroll-smooth"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`.gallery-track::-webkit-scrollbar{display:none}`}</style>
        {items.map((item, index) => (
          <div
            key={item.title}
            className="group shrink-0 overflow-hidden rounded-[1.75rem] border border-[var(--lp-border)] bg-[var(--lp-card)] shadow-[0_12px_40px_rgba(16,38,29,0.06)]"
            style={{ scrollSnapAlign: 'start', width: 'clamp(280px, 72vw, 380px)' }}
          >
            <div className="relative h-64 overflow-hidden bg-[linear-gradient(135deg,rgba(31,90,67,0.18),rgba(215,195,161,0.28),rgba(117,196,210,0.14))]">
              <div className="absolute inset-0 transition duration-500 group-hover:scale-110 group-hover:rotate-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.22),transparent_22%),linear-gradient(180deg,transparent,rgba(16,38,29,0.28))]" />
              </div>
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/60 px-3 py-1 text-xs font-medium text-[#2c3a35] backdrop-blur-md">
                <Camera className="h-3.5 w-3.5" />
                {item.category}
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-white/85">Image slot {index + 1}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Prev button */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-1)}
          className="absolute -left-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--lp-border)] bg-[var(--lp-card-solid)] shadow-lg text-[var(--lp-text)] transition hover:bg-[var(--lp-tan)] sm:-left-5"
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Next button */}
      {canScrollRight && (
        <button
          onClick={() => scrollBy(1)}
          className="absolute -right-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--lp-border)] bg-[var(--lp-card-solid)] shadow-lg text-[var(--lp-text)] transition hover:bg-[var(--lp-tan)] sm:-right-5"
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Dot indicators */}
      <div className="mt-5 flex justify-center gap-2">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === activeIndex
                ? 'w-6 bg-[var(--lp-green)]'
                : 'w-2 bg-[var(--lp-border)]'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
