'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, MapPin } from 'lucide-react';
import { DIFFICULTY_ORDER, trailsByDifficulty } from '@/data/trails';
import { DIFFICULTY_STYLE, badgeLabel } from '@/components/map/difficulty';

/**
 * Trail cards under the map.
 *
 * Deliberately not part of InteractiveTrailMap: that component is loaded with
 * `ssr: false` because Leaflet needs `window`, so anything inside it is missing
 * from the HTML a crawler reads. Rendered here, every card — including the ones
 * scrolled out of view — ships in the server HTML with a link to its
 * /trails page, which is the homepage's crawl path into those pages.
 */

const TRAILS_IN_ORDER = DIFFICULTY_ORDER.flatMap(trailsByDifficulty);

export function TrailCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    function updateState() {
      if (!el) return;
      setCanLeft(el.scrollLeft > 8);
      setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
      const cardWidth = el.scrollWidth / TRAILS_IN_ORDER.length;
      setActiveIndex(Math.round(el.scrollLeft / cardWidth));
    }

    updateState();
    el.addEventListener('scroll', updateState, { passive: true });
    return () => el.removeEventListener('scroll', updateState);
  }, []);

  function scrollToCard(index: number) {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / TRAILS_IN_ORDER.length;
    el.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  }

  return (
    <div className="relative mt-8">
      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto pb-2"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {TRAILS_IN_ORDER.map((trail) => {
          const style = DIFFICULTY_STYLE[trail.difficulty];
          return (
            <div
              key={trail.slug}
              className="relative flex shrink-0 flex-col rounded-[1.5rem] border border-[var(--lp-border)] bg-[var(--lp-card)] p-5 shadow-[0_8px_28px_rgba(16,38,29,0.05)] transition hover:border-[var(--lp-green)] focus-within:border-[var(--lp-green)]"
              style={{ scrollSnapAlign: 'start', width: 'clamp(260px, 68vw, 320px)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="shrink-0 rounded-xl p-2"
                  style={{ background: `${style.color}20`, color: style.color }}
                >
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.badge}`}>
                  {badgeLabel(trail)}
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-[14px] font-semibold leading-tight text-[var(--lp-text)]">
                  {/* Stretched link: the whole card opens the trail page, and the
                      trail name is the anchor text. */}
                  <Link
                    href={`/trails/${trail.slug}`}
                    className="after:absolute after:inset-0 after:rounded-[1.5rem] focus-visible:outline-none"
                  >
                    {trail.name}
                  </Link>
                </h3>
                <p className="mt-0.5 text-xs text-[var(--lp-text-nav)]">{trail.city}, FL</p>
              </div>
              <p className="mt-2.5 text-xs leading-5 text-[var(--lp-text-body)]">{trail.description}</p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                <span className="text-xs font-semibold text-[var(--lp-green)]" aria-hidden="true">
                  Trail details &rarr;
                </span>
                <a
                  href={trail.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-10 inline-flex items-center gap-1 text-xs font-medium text-[var(--lp-text-nav)] transition hover:text-[var(--lp-green)]"
                >
                  Open in Maps
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Arrows */}
      {canLeft && (
        <button
          onClick={() => scrollToCard(activeIndex - 1)}
          className="absolute -left-4 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--lp-border)] bg-[var(--lp-card-solid)] text-[var(--lp-text)] shadow transition hover:bg-[var(--lp-tan)]"
          aria-label="Previous trail"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canRight && (
        <button
          onClick={() => scrollToCard(activeIndex + 1)}
          className="absolute -right-4 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--lp-border)] bg-[var(--lp-card-solid)] text-[var(--lp-text)] shadow transition hover:bg-[var(--lp-tan)]"
          aria-label="Next trail"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Dots */}
      <div className="mt-4 flex justify-center gap-1.5">
        {TRAILS_IN_ORDER.map((trail, i) => (
          <button
            key={trail.slug}
            onClick={() => scrollToCard(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIndex ? 'w-5 bg-[var(--lp-green)]' : 'w-1.5 bg-[var(--lp-border)]'
            }`}
            aria-label={`Go to ${trail.name}`}
          />
        ))}
      </div>
    </div>
  );
}
