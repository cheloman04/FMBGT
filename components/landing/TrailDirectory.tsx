import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { CITIES } from '@/data/cities';
import { DIFFICULTY_ORDER, TRAILS, type Difficulty } from '@/data/trails';

/**
 * Server-rendered directory of every ride location.
 *
 * The interactive map is loaded with `ssr: false` (Leaflet touches `window` at
 * import time), so nothing inside it exists in the HTML a crawler reads first.
 * This block carries the same trail content in plain markup and, unlike the
 * map, links out to a real URL per trail — which is also what gives the
 * /trails pages a crawl path from the homepage.
 */

const BADGE: Record<Difficulty, string> = {
  'First Time': 'bg-emerald-100 text-emerald-800',
  Beginner: 'bg-teal-100 text-teal-800',
  Intermediate: 'bg-amber-100 text-amber-800',
  Advanced: 'bg-red-100 text-red-800',
};

export function TrailDirectory() {
  return (
    <div className="mt-16">
      <h3 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
        Every trail we guide, by difficulty
      </h3>
      <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--lp-text-body)]">
        Twelve ride locations across Central Florida, from first-ever rides on wide open
        trail to technical singletrack at Santos. Each one has its own page with the
        meeting point, what the terrain is like, and who it suits.
      </p>

      {DIFFICULTY_ORDER.map((difficulty) => {
        const group = TRAILS.filter((t) => t.difficulty === difficulty);
        if (group.length === 0) return null;

        return (
          <section key={difficulty} className="mt-10">
            <h4 className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--lp-text-muted)]">
              {difficulty}
              <span className="h-px flex-1 bg-[var(--lp-border)]" />
              <span className="text-xs normal-case tracking-normal">
                {group.length} {group.length === 1 ? 'trail' : 'trails'}
              </span>
            </h4>

            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((trail) => (
                <li key={trail.slug}>
                  <Link
                    href={`/trails/${trail.slug}`}
                    className="flex h-full flex-col rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card-70)] p-5 transition hover:border-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h5 className="text-base font-bold leading-snug text-[var(--lp-text)]">
                        {trail.name}
                      </h5>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide ${BADGE[trail.difficulty]}`}
                      >
                        {trail.terrain === 'paved' ? 'Paved' : trail.difficulty}
                      </span>
                    </div>

                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--lp-text-muted)]">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {trail.city}, FL
                    </p>

                    <p className="mt-3 text-sm leading-6 text-[var(--lp-text-body)]">
                      {trail.description}
                    </p>

                    <span className="mt-4 text-sm font-semibold text-[var(--lp-green)]">
                      Trail details &rarr;
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {/* The homepage's crawl path into the city and guide pages. Without these
          links those pages exist but nothing points at them. */}
      <section className="mt-14 border-t border-[var(--lp-border)] pt-10">
        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--lp-text-muted)]">
          Browse by area
        </h4>
        <ul className="mt-4 flex flex-wrap gap-2.5">
          {CITIES.map((city) => (
            <li key={city.slug}>
              <Link
                href={`/tours/${city.slug}`}
                className="inline-block rounded-full border border-[var(--lp-border)] px-4 py-2 text-sm font-medium text-[var(--lp-text-body)] transition hover:border-[var(--lp-green)] hover:text-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
              >
                Bike tours in {city.name}
              </Link>
            </li>
          ))}
        </ul>

        <h4 className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--lp-text-muted)]">
          Ride guides
        </h4>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            {
              href: '/guides/central-florida-mountain-bike-trails',
              title: 'Every trail, compared',
              text: 'All twelve locations sorted by how hard they actually are.',
            },
            {
              href: '/guides/beginner-mountain-biking-orlando',
              title: 'Beginner riding near Orlando',
              text: 'Where to start if you have never ridden a trail before.',
            },
            {
              href: '/guides/blue-spring-manatee-bike-tour',
              title: 'Blue Spring manatee season',
              text: 'Riding to the springs when the manatees move in.',
            },
          ].map((guide) => (
            <li key={guide.href}>
              <Link
                href={guide.href}
                className="flex h-full flex-col rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card-70)] p-5 transition hover:border-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
              >
                <span className="font-bold text-[var(--lp-text)]">{guide.title}</span>
                <span className="mt-2 text-sm leading-6 text-[var(--lp-text-body)]">
                  {guide.text}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
