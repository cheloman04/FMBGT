import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { getTrail } from '@/data/trails';
import {
  SITE_URL,
  breadcrumbSchema,
  faqPageSchema,
  jsonLd,
  type Crumb,
} from '@/lib/seo';

const TITLE = 'Blue Spring Manatee Season by Bike — Guided Rides from DeLand';
const DESCRIPTION =
  'Ride the paved Spring to Spring Trail toward Blue Spring State Park during manatee season. What to expect, when manatees gather, and how the guided ride works.';
const PAGE_URL = `${SITE_URL}/guides/blue-spring-manatee-bike-tour`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: 'Florida Mountain Bike Guides',
    images: [`${SITE_URL}/opengraph-image`],
    locale: 'en_US',
    type: 'article',
  },
  robots: { index: true, follow: true },
};

const crumbs: Crumb[] = [
  { name: 'Home', url: SITE_URL },
  { name: 'Ride guides', url: `${SITE_URL}/guides/central-florida-mountain-bike-trails` },
  { name: 'Blue Spring manatee season' },
];

const FAQS = [
  {
    q: 'When is manatee season at Blue Spring?',
    a: 'Manatees move into the Blue Spring run when the St. Johns River cools, which in practice means the colder months of the year. Numbers rise and fall with the weather rather than the calendar — a warm spell will empty the run and a cold snap will fill it. Ask us what the last few days have looked like when you book.',
  },
  {
    q: 'Will I definitely see manatees on the ride?',
    a: 'No, and we will not pretend otherwise. They are wild animals in a spring run, not an exhibit. What we can tell you is whether it is the right time of year and what conditions have been like recently.',
  },
  {
    q: 'Is this a mountain bike tour?',
    a: 'No. The Spring to Spring Trail section we ride is paved, which is why this tour suits families, mixed-ability groups and riders who have not been on a bike in a while.',
  },
  {
    q: 'Where does the ride start?',
    a: 'At Lake Beresford Park, 2100 Fatio Rd, DeLand FL 32720, on the Spring to Spring Trail. Bikes and helmets are provided and ready when you arrive.',
  },
  {
    q: 'How long does the tour take?',
    a: 'Paved trail tours run around 2 to 3 hours depending on the route and the pace of the group.',
  },
];

export default function BlueSpringGuidePage() {
  const trail = getTrail('spring-to-spring-blue-spring');

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbSchema(crumbs))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(faqPageSchema(FAQS))}
      />

      <SiteHeader />

      <main className="bg-[var(--lp-bg)]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <Breadcrumbs crumbs={crumbs} />

          <h1 className="text-3xl font-bold tracking-tight text-[var(--lp-text)] sm:text-4xl lg:text-5xl">
            Blue Spring manatee season, by bike
          </h1>

          <div className="mt-6 flex flex-col gap-4 text-base leading-8 text-[var(--lp-text-body)] sm:text-lg">
            <p>
              Blue Spring State Park is one of the most reliable places in Florida to see
              manatees, and in the colder months the spring run becomes a refuge for them. Most
              visitors drive in, park, walk the boardwalk and leave.
            </p>
            <p>
              The bike version is a better day. The Spring to Spring Trail runs through shaded
              riverfront on smooth pavement, which means you arrive having actually seen the
              landscape the spring sits in rather than just the car park.
            </p>
          </div>

          <section className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
              Why manatees gather here
            </h2>
            <p className="mt-3 text-base leading-8 text-[var(--lp-text-body)]">
              Florida&rsquo;s springs run at a near-constant temperature year round. When the St.
              Johns River drops below what manatees can tolerate, they move into the warmer
              spring run and stay until the river warms back up. That is why the season tracks
              cold weather rather than dates: a mild winter week will thin the numbers out, and
              a genuine cold snap will pack them in.
            </p>
            <p className="mt-4 text-base leading-8 text-[var(--lp-text-body)]">
              It also means nobody can promise you manatees on a particular morning. Anyone who
              does is selling you something. What a local guide can do is tell you what the
              water has been doing that week.
            </p>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
              The ride itself
            </h2>
            <p className="mt-3 text-base leading-8 text-[var(--lp-text-body)]">
              Paved trail throughout, at a relaxed pace, with a bike and helmet waiting for you
              at the meeting point. No off-road sections and no technical riding &mdash; this is
              the tour we recommend for families, for mixed-ability groups, and for anyone whose
              last ride was a long time ago.
            </p>

            {trail && (
              <div className="mt-6 rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card-70)] p-6">
                <h3 className="text-base font-bold text-[var(--lp-text)]">Meeting point</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--lp-text-body)]">
                  {trail.meetingPointName}
                  <br />
                  {trail.meetingPointAddress}
                </p>
                <a
                  href={trail.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--lp-green)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
                >
                  Open in Google Maps
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <p className="mt-4 text-sm leading-7 text-[var(--lp-text-muted)]">
                  Full detail on this route:{' '}
                  <Link
                    href={`/trails/${trail.slug}`}
                    className="font-semibold text-[var(--lp-green)] underline-offset-4 hover:underline"
                  >
                    {trail.name}
                  </Link>
                </p>
              </div>
            )}
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
              Common questions
            </h2>
            <dl className="mt-6 flex flex-col gap-6">
              {FAQS.map((faq) => (
                <div key={faq.q} className="border-t border-[var(--lp-border)] pt-5">
                  <dt className="text-base font-semibold text-[var(--lp-text)]">{faq.q}</dt>
                  <dd className="mt-2 text-sm leading-7 text-[var(--lp-text-body)]">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-14 rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card-70)] p-7">
            <h2 className="text-xl font-bold text-[var(--lp-text)]">Ride it this season</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--lp-text-body)]">
              Pick a date and we will tell you honestly what the spring has been like that week.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/booking"
                className="rounded-full bg-[var(--lp-green)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--lp-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)] focus-visible:ring-offset-2"
              >
                Book the Blue Spring ride
              </Link>
              <Link
                href="/tours/deland"
                className="rounded-full border border-[var(--lp-border)] px-6 py-3 text-sm font-semibold text-[var(--lp-text)] transition hover:border-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
              >
                All DeLand tours
              </Link>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
