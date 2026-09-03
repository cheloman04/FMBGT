import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { CITIES, cityTrails, getCity } from '@/data/cities';
import { DIFFICULTY_COPY } from '@/data/trails';
import {
  SITE_URL,
  breadcrumbSchema,
  faqPageSchema,
  jsonLd,
  type Crumb,
} from '@/lib/seo';

interface PageProps {
  params: Promise<{ city: string }>;
}

export function generateStaticParams() {
  return CITIES.map((city) => ({ city: city.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) return {};

  const url = `${SITE_URL}/tours/${city.slug}`;
  return {
    title: city.metaTitle,
    description: city.metaDescription,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: url },
    openGraph: {
      title: city.metaTitle,
      description: city.metaDescription,
      url,
      siteName: 'Florida Mountain Bike Guides',
      images: [`${SITE_URL}/opengraph-image`],
      locale: 'en_US',
      type: 'website',
    },
    robots: { index: true, follow: true },
  };
}

export default async function CityToursPage({ params }: PageProps) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();

  const trails = cityTrails(city);
  const crumbs: Crumb[] = [
    { name: 'Home', url: SITE_URL },
    { name: 'Tours', url: `${SITE_URL}/tours/${city.slug}` },
    { name: city.name },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbSchema(crumbs))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(faqPageSchema(city.faqs))}
      />

      <SiteHeader />

      <main className="bg-[var(--lp-bg)]">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
          <Breadcrumbs crumbs={crumbs} />

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lp-text-muted)]">
            {city.region}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--lp-text)] sm:text-4xl lg:text-5xl">
            {city.heading}
          </h1>

          <div className="mt-6 flex flex-col gap-4 text-base leading-7 text-[var(--lp-text-body)] sm:text-lg">
            <p>{city.intro}</p>
            <p>{city.suits}</p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/booking"
              className="rounded-full bg-[var(--lp-green)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--lp-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)] focus-visible:ring-offset-2"
            >
              Book a tour in {city.name}
            </Link>
            <Link
              href="/guides/central-florida-mountain-bike-trails"
              className="rounded-full border border-[var(--lp-border)] px-6 py-3 text-sm font-semibold text-[var(--lp-text)] transition hover:border-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
            >
              Compare all trails
            </Link>
          </div>

          {/* Trails */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
              Where we ride around {city.name}
            </h2>

            <ul className="mt-6 flex flex-col gap-4">
              {trails.map((trail) => (
                <li key={trail.slug}>
                  <Link
                    href={`/trails/${trail.slug}`}
                    className="block rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card-70)] p-6 transition hover:border-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-lg font-bold text-[var(--lp-text)]">{trail.name}</h3>
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--lp-green)]">
                        {trail.terrain === 'paved' ? 'Paved trail' : trail.difficulty}
                      </span>
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--lp-text-muted)]">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {trail.meetingPointName} &middot; {trail.meetingPointAddress}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--lp-text-body)]">
                      {trail.description}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--lp-text-muted)]">
                      {DIFFICULTY_COPY[trail.difficulty]}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* City FAQ */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
              {city.name} tour questions
            </h2>
            <dl className="mt-6 flex flex-col gap-6">
              {city.faqs.map((faq) => (
                <div key={faq.q} className="border-t border-[var(--lp-border)] pt-5">
                  <dt className="text-base font-semibold text-[var(--lp-text)]">{faq.q}</dt>
                  <dd className="mt-2 text-sm leading-7 text-[var(--lp-text-body)]">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Sibling city links — keeps every city page one hop from the others */}
          <section className="mt-16 border-t border-[var(--lp-border)] pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--lp-text-muted)]">
              Other areas we guide
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {CITIES.filter((c) => c.slug !== city.slug).map((other) => (
                <li key={other.slug}>
                  <Link
                    href={`/tours/${other.slug}`}
                    className="inline-block rounded-full border border-[var(--lp-border)] px-4 py-2 text-sm text-[var(--lp-text-body)] transition hover:border-[var(--lp-green)] hover:text-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
                  >
                    {other.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
