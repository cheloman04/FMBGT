import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, MapPin } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { CITIES } from '@/data/cities';
import { DIFFICULTY_COPY, TRAILS, getTrail, trailsForCity } from '@/data/trails';
import {
  SITE_URL,
  breadcrumbSchema,
  jsonLd,
  trailTourSchema,
  type Crumb,
} from '@/lib/seo';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return TRAILS.map((trail) => ({ slug: trail.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const trail = getTrail(slug);
  if (!trail) return {};

  const kind = trail.terrain === 'paved' ? 'Paved Trail Ride' : 'Mountain Bike Tour';
  const title = `${trail.name} | Guided ${kind} in ${trail.city}, FL`;
  const description = `${trail.description} Guided tours from Florida Mountain Bike Guides, meeting at ${trail.meetingPointName} in ${trail.city}. Bike and helmet included.`;
  const url = `${SITE_URL}/trails/${trail.slug}`;

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Florida Mountain Bike Guides',
      images: [`${SITE_URL}/opengraph-image`],
      locale: 'en_US',
      type: 'website',
    },
    robots: { index: true, follow: true },
  };
}

export default async function TrailPage({ params }: PageProps) {
  const { slug } = await params;
  const trail = getTrail(slug);
  if (!trail) notFound();

  const city = CITIES.find((c) => c.key === trail.cityKey);
  const nearby = trailsForCity(trail.cityKey).filter((t) => t.slug !== trail.slug);
  const isPaved = trail.terrain === 'paved';

  const crumbs: Crumb[] = [
    { name: 'Home', url: SITE_URL },
    ...(city ? [{ name: city.name, url: `${SITE_URL}/tours/${city.slug}` }] : []),
    { name: trail.name },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbSchema(crumbs))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(trailTourSchema(trail))}
      />

      <SiteHeader />

      <main className="bg-[var(--lp-bg)]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <Breadcrumbs crumbs={crumbs} />

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lp-text-muted)]">
            {isPaved ? 'Paved trail ride' : 'Mountain bike tour'} &middot; {trail.difficulty}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--lp-text)] sm:text-4xl">
            {trail.name}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[var(--lp-text-muted)]">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {trail.city}, Florida
          </p>

          <p className="mt-6 text-lg leading-8 text-[var(--lp-text-body)]">{trail.description}</p>

          <Link
            href="/booking"
            className="mt-8 inline-block rounded-full bg-[var(--lp-green)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--lp-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)] focus-visible:ring-offset-2"
          >
            Book a guided ride here
          </Link>

          {/* Facts we can actually stand behind */}
          <section className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)]">
              Riding {trail.name} with a guide
            </h2>

            <dl className="mt-6 divide-y divide-[var(--lp-border)] border-y border-[var(--lp-border)]">
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-semibold text-[var(--lp-text)]">Difficulty</dt>
                <dd className="text-sm leading-6 text-[var(--lp-text-body)]">
                  <strong className="font-semibold text-[var(--lp-text)]">{trail.difficulty}</strong>
                  {' — '}
                  {DIFFICULTY_COPY[trail.difficulty]}
                </dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-semibold text-[var(--lp-text)]">Surface</dt>
                <dd className="text-sm leading-6 text-[var(--lp-text-body)]">
                  {isPaved
                    ? 'Paved trail throughout — no off-road sections, suitable for mixed-ability groups and younger riders.'
                    : 'Off-road singletrack. Bikes are full-suspension mountain bikes unless you bring your own.'}
                </dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-semibold text-[var(--lp-text)]">Tour length</dt>
                <dd className="text-sm leading-6 text-[var(--lp-text-body)]">
                  {isPaved
                    ? 'Around 2–3 hours depending on the route and the pace of the group.'
                    : 'Around 2 hours as standard, with 3 and 4-hour options available when you book.'}
                </dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-semibold text-[var(--lp-text)]">What&rsquo;s included</dt>
                <dd className="text-sm leading-6 text-[var(--lp-text-body)]">
                  Bike, helmet and a local guide, ready at the meeting point.
                  {!isPaved && ' Bring Your Own Bike is available at a lower rate.'}
                </dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-semibold text-[var(--lp-text)]">Meeting point</dt>
                <dd className="text-sm leading-6 text-[var(--lp-text-body)]">
                  {trail.meetingPointName}
                  <br />
                  {trail.meetingPointAddress}
                  <br />
                  <a
                    href={trail.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-[var(--lp-green)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
                  >
                    Open in Google Maps
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          {nearby.length > 0 && city && (
            <section className="mt-14">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)]">
                Other rides near {city.name}
              </h2>
              <ul className="mt-5 flex flex-col gap-3">
                {nearby.map((other) => (
                  <li key={other.slug}>
                    <Link
                      href={`/trails/${other.slug}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-70)] px-5 py-4 transition hover:border-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
                    >
                      <span className="font-semibold text-[var(--lp-text)]">{other.name}</span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--lp-text-muted)]">
                        {other.city} &middot; {other.difficulty}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-14 border-t border-[var(--lp-border)] pt-8">
            <p className="text-sm leading-7 text-[var(--lp-text-body)]">
              {city && (
                <>
                  See every ride we run around{' '}
                  <Link
                    href={`/tours/${city.slug}`}
                    className="font-semibold text-[var(--lp-green)] underline-offset-4 hover:underline"
                  >
                    {city.name}
                  </Link>
                  , or{' '}
                </>
              )}
              <Link
                href="/guides/central-florida-mountain-bike-trails"
                className="font-semibold text-[var(--lp-green)] underline-offset-4 hover:underline"
              >
                compare all twelve Central Florida trails
              </Link>{' '}
              side by side.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
