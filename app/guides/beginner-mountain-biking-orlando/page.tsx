import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { faqItems } from '@/data/faqs';
import { trailsByDifficulty } from '@/data/trails';
import {
  SITE_URL,
  breadcrumbSchema,
  faqPageSchema,
  jsonLd,
  type Crumb,
} from '@/lib/seo';

const TITLE = 'Beginner Mountain Biking Near Orlando: Where to Start | Florida Mountain Bike Guides';
const DESCRIPTION =
  'Never ridden a trail? Here is where to start mountain biking near Orlando — which trails are genuinely beginner-friendly, what to wear, and what actually happens on a first guided ride.';
const PAGE_URL = `${SITE_URL}/guides/beginner-mountain-biking-orlando`;

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
  { name: 'Beginner mountain biking' },
];

/** The subset of the site FAQ a first-timer actually asks. */
const BEGINNER_FAQ_QUESTIONS = [
  'Are the tours beginner-friendly?',
  'Do I need to bring my own bike?',
  'What should I wear or bring?',
  'How long are the tours?',
  'Are tours suitable for families and kids?',
];

export default function BeginnerGuidePage() {
  const firstTime = trailsByDifficulty('First Time');
  const beginner = trailsByDifficulty('Beginner');
  const faqs = faqItems.filter((f) => BEGINNER_FAQ_QUESTIONS.includes(f.q));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbSchema(crumbs))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(faqPageSchema(faqs))}
      />

      <SiteHeader />

      <main className="bg-[var(--lp-bg)]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <Breadcrumbs crumbs={crumbs} />

          <h1 className="text-3xl font-bold tracking-tight text-[var(--lp-text)] sm:text-4xl lg:text-5xl">
            Beginner mountain biking near Orlando
          </h1>

          <div className="mt-6 flex flex-col gap-4 text-base leading-8 text-[var(--lp-text-body)] sm:text-lg">
            <p>
              Most people who tell us they &ldquo;can&rsquo;t mountain bike&rdquo; have simply
              never been taken somewhere appropriate. The gap between a wide, flat, open trail
              and a rooty technical one is enormous, and starting on the wrong side of it is what
              convinces people the sport is not for them.
            </p>
            <p>
              This page covers what a genuine beginner needs: which trails near Orlando are
              actually suitable, what to bring, and what a first guided ride looks like from
              arrival to finish.
            </p>
          </div>

          <section className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
              Start here if you have never ridden a trail
            </h2>
            <p className="mt-3 text-base leading-7 text-[var(--lp-text-body)]">
              These are the trails we rate <strong>First Time</strong>: wide, open, and free of
              technical features. Nothing on them requires a skill you do not already have from
              riding a bike on a path.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {firstTime.map((trail) => (
                <li key={trail.slug}>
                  <Link
                    href={`/trails/${trail.slug}`}
                    className="block rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-70)] px-5 py-4 transition hover:border-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
                  >
                    <span className="font-semibold text-[var(--lp-text)]">{trail.name}</span>
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-[var(--lp-text-muted)]">
                      {trail.city}
                    </span>
                    <span className="mt-1.5 block text-sm leading-6 text-[var(--lp-text-body)]">
                      {trail.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
              The next step up
            </h2>
            <p className="mt-3 text-base leading-7 text-[var(--lp-text-body)]">
              Once braking, cornering and body position stop taking conscious effort, these are
              where riders go next — light roots and gentle turns, still forgiving.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {beginner.map((trail) => (
                <li key={trail.slug}>
                  <Link
                    href={`/trails/${trail.slug}`}
                    className="block rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-70)] px-5 py-4 transition hover:border-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
                  >
                    <span className="font-semibold text-[var(--lp-text)]">{trail.name}</span>
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-[var(--lp-text-muted)]">
                      {trail.city}
                    </span>
                    <span className="mt-1.5 block text-sm leading-6 text-[var(--lp-text-body)]">
                      {trail.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
              What a first guided ride actually looks like
            </h2>
            <ol className="mt-6 flex flex-col gap-5">
              {[
                ['Arrive at the trailhead', 'Your bike and helmet are already there. Nothing to transport, nothing to assemble.'],
                ['Get fitted', 'Saddle height and brake reach get set for you before you ride, not after you are already uncomfortable.'],
                ['The basics, on flat ground', 'Braking with both levers, where to put your weight, how to look through a turn. Five minutes, not a lecture.'],
                ['Ride at your pace', 'The guide sets a speed the slowest rider is comfortable with, and stops as often as the group needs.'],
                ['Finish at the trailhead', 'Same place you started. Most people finish having ridden further than they expected to.'],
              ].map(([step, detail], i) => (
                <li key={step} className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--lp-green)] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-[var(--lp-text)]">{step}</h3>
                    <p className="mt-1 text-sm leading-7 text-[var(--lp-text-body)]">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--lp-text)] sm:text-3xl">
              Questions first-timers ask
            </h2>
            <dl className="mt-6 flex flex-col gap-6">
              {faqs.map((faq) => (
                <div key={faq.q} className="border-t border-[var(--lp-border)] pt-5">
                  <dt className="text-base font-semibold text-[var(--lp-text)]">{faq.q}</dt>
                  <dd className="mt-2 text-sm leading-7 text-[var(--lp-text-body)]">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-14 rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card-70)] p-7">
            <h2 className="text-xl font-bold text-[var(--lp-text)]">Ready for a first ride?</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--lp-text-body)]">
              Pick a First Time trail and a date. Bike, helmet and guide are waiting at the
              trailhead &mdash; you just show up.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/booking"
                className="rounded-full bg-[var(--lp-green)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--lp-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)] focus-visible:ring-offset-2"
              >
                Book a beginner tour
              </Link>
              <Link
                href="/tours/orlando"
                className="rounded-full border border-[var(--lp-border)] px-6 py-3 text-sm font-semibold text-[var(--lp-text)] transition hover:border-[var(--lp-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
              >
                See Orlando tours
              </Link>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
