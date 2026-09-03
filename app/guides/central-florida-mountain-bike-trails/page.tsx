import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { CITIES } from '@/data/cities';
import { DIFFICULTY_COPY, DIFFICULTY_ORDER, TRAILS } from '@/data/trails';
import { SITE_URL, breadcrumbSchema, jsonLd, type Crumb } from '@/lib/seo';

const TITLE = 'Central Florida Mountain Bike Trails: All 12, Compared by Difficulty';
const DESCRIPTION =
  'Every mountain bike and paved trail we guide across Central Florida, sorted by difficulty — from first-ever rides at Lake Druid to technical singletrack at Santos. Meeting points included.';
const PAGE_URL = `${SITE_URL}/guides/central-florida-mountain-bike-trails`;

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
  { name: 'Ride guides', url: PAGE_URL },
  { name: 'Central Florida trails' },
];

export default function TrailComparisonGuide() {
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Central Florida mountain bike and paved trails',
    numberOfItems: TRAILS.length,
    itemListElement: TRAILS.map((trail, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: trail.name,
      url: `${SITE_URL}/trails/${trail.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbSchema(crumbs))}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(itemList)} />

      <SiteHeader />

      <main className="bg-[var(--lp-bg)]">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
          <Breadcrumbs crumbs={crumbs} />

          <h1 className="text-3xl font-bold tracking-tight text-[var(--lp-text)] sm:text-4xl lg:text-5xl">
            Every Central Florida trail we guide, compared
          </h1>

          <div className="mt-6 flex flex-col gap-4 text-base leading-8 text-[var(--lp-text-body)] sm:text-lg">
            <p>
              Florida has a reputation for being flat, and the riding here gets written off
              because of it. That reputation is wrong in the places that matter: Santos has
              terrain that would be respectable anywhere, and the coastal trails are tighter and
              rootier than most people expect.
            </p>
            <p>
              This is the honest version of where we ride — twelve locations across six areas,
              sorted by how hard they actually are rather than how they photograph. If you are
              choosing a first ride, start at the top. If the beginner trails have stopped being
              interesting, skip to Intermediate.
            </p>
          </div>

          {DIFFICULTY_ORDER.map((difficulty) => {
            const group = TRAILS.filter((t) => t.difficulty === difficulty);
            if (group.length === 0) return null;

            return (
              <section key={difficulty} className="mt-14">
                <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
                  {difficulty}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--lp-text-muted)]">
                  {DIFFICULTY_COPY[difficulty]}
                </p>

                <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--lp-border)]">
                  <table className="w-full min-w-[36rem] border-collapse bg-[var(--lp-card-70)] text-left">
                    <thead>
                      <tr className="border-b border-[var(--lp-border)]">
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lp-text-muted)]">
                          Trail
                        </th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lp-text-muted)]">
                          Where
                        </th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lp-text-muted)]">
                          What it&rsquo;s like
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((trail) => (
                        <tr
                          key={trail.slug}
                          className="border-b border-[var(--lp-border)] last:border-b-0 align-top"
                        >
                          <td className="px-5 py-4">
                            <Link
                              href={`/trails/${trail.slug}`}
                              className="font-semibold text-[var(--lp-green)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
                            >
                              {trail.name}
                            </Link>
                            {trail.terrain === 'paved' && (
                              <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-[var(--lp-text-muted)]">
                                Paved
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-sm text-[var(--lp-text-body)]">
                            {trail.city}, FL
                          </td>
                          <td className="px-5 py-4 text-sm leading-6 text-[var(--lp-text-body)]">
                            {trail.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
              Browse by area instead
            </h2>
            <p className="mt-2 text-base leading-7 text-[var(--lp-text-body)]">
              If you already know where you are staying, start there.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {CITIES.map((city) => (
                <li key={city.slug}>
                  <Link
                    href={`/tours/${city.slug}`}
                    className="block rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-70)] px-5 py-4 transition hover:border-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
                  >
                    <span className="font-semibold text-[var(--lp-text)]">{city.name}</span>
                    <span className="mt-0.5 block text-xs text-[var(--lp-text-muted)]">
                      {city.region}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14 rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card-70)] p-7">
            <h2 className="text-xl font-bold text-[var(--lp-text)]">
              Not sure which one is right?
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--lp-text-body)]">
              Tell us your experience level and where you are staying, and we will point you at
              the trail that actually fits — including telling you when the answer is a different
              one than the one you asked about.
            </p>
            <Link
              href="/booking"
              className="mt-5 inline-block rounded-full bg-[var(--lp-green)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--lp-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)] focus-visible:ring-offset-2"
            >
              Book a guided tour
            </Link>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
