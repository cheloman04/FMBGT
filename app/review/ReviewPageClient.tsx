'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CTAButton } from '@/components/ui/CTAButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const REVIEW_URL = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ?? '';
const SUPPORT_EMAIL = 'floridamountainbikeguides@gmail.com';
const LOGO_SRC = '/images/branding/logo fmbtg (800 x 800 px).png';
const NAV_LINKS = [
  { href: '/#tours', label: 'Tours' },
  { href: '/#map', label: 'Map' },
  { href: '/#guides', label: 'Guides' },
  { href: '/#fleet', label: 'Fleet' },
  { href: '/#contact', label: 'Contact' },
] as const;

export type ReviewPageProps = {
  params: Record<string, string | string[] | undefined>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function labelTrailType(trailType?: string) {
  if (trailType === 'mtb') return 'mountain bike';
  if (trailType === 'paved') return 'paved trail';
  return 'guided ride';
}

function buildReviewHref(queryString: string) {
  if (!REVIEW_URL) return '';
  if (!queryString) return REVIEW_URL;
  const separator = REVIEW_URL.includes('?') ? '&' : '?';
  return `${REVIEW_URL}${separator}${queryString}`;
}

export function ReviewPageClient({ params }: ReviewPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const derived = useMemo(() => {
    const firstName = firstParam(params.first_name)?.trim();
    const trailType = firstParam(params.trail_type)?.trim();
    const locationName = firstParam(params.location_name)?.trim();
    const flow = firstParam(params.flow)?.trim();
    const templateKey = firstParam(params.template_key)?.trim();
    const stepKey = firstParam(params.step_key)?.trim();
    const enrollmentId = firstParam(params.enrollment_id)?.trim();
    const bookingId = firstParam(params.booking_id)?.trim();

    const reviewQuery = new URLSearchParams();
    const passthroughKeys = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'utm_id',
      'flow',
      'sequence_key',
      'template_key',
      'step_key',
      'enrollment_id',
      'booking_id',
      'trail_type',
      'location_name',
      'cta',
      'first_name',
    ] as const;

    for (const key of passthroughKeys) {
      const value = firstParam(params[key]);
      if (value) {
        reviewQuery.set(key, value);
      }
    }

    return {
      firstName,
      rideLabel: labelTrailType(trailType),
      locationName,
      flow,
      templateKey,
      stepKey,
      enrollmentId,
      bookingId,
      reviewHref: buildReviewHref(reviewQuery.toString()),
    };
  }, [params]);

  const detailChips = [
    derived.locationName ? `Location: ${derived.locationName}` : null,
    derived.templateKey ? `Template: ${derived.templateKey}` : null,
    derived.stepKey ? `Step: ${derived.stepKey}` : null,
  ].filter(Boolean) as string[];

  return (
    <main className="min-h-screen bg-[var(--lp-bg)] text-[var(--lp-text)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-8rem] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-[18rem] h-[18rem] w-[18rem] rounded-full bg-[#d7c3a1]/30 blur-3xl" />
        <div className="absolute left-[-6rem] bottom-[8rem] h-[16rem] w-[16rem] rounded-full bg-cyan-200/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-[var(--lp-border)] bg-[var(--lp-bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={LOGO_SRC}
              alt="Florida Mountain Bike Guides logo"
              width={52}
              height={52}
              className="rounded-full"
              priority
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--lp-green)]">
                Florida Mountain Bike Guides
              </p>
              <p className="text-xs text-[var(--lp-text-muted)]">Mountain biking in the land of no mountains</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-[var(--lp-text-nav)] md:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="transition hover:text-[var(--lp-text)]">
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <CTAButton href="/booking" trackLocation="review_nav" onClick={() => {}}>Book a Guide</CTAButton>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-60)] text-[var(--lp-green)] transition hover:bg-[var(--lp-card-solid)]"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-[var(--lp-border)] bg-[var(--lp-bg)]/95 backdrop-blur-xl md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col px-4 py-4 sm:px-6">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-[var(--lp-border-soft)] py-3.5 text-sm font-medium text-[var(--lp-text-dark)] transition hover:text-[var(--lp-green)]"
                >
                  {label}
                </Link>
              ))}
              <div className="pt-4">
                <CTAButton href="/booking" trackLocation="review_mobile_nav" onClick={() => setMenuOpen(false)}>Book a Guide</CTAButton>
              </div>
            </nav>
          </div>
        )}
      </header>

      <section className="relative mx-auto grid min-h-[calc(100vh-85px)] max-w-6xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-10">
        <div className="space-y-6 rounded-[2rem] border border-[var(--lp-border)] bg-[var(--lp-card-80)] p-7 shadow-[0_22px_80px_rgba(16,38,29,0.10)] backdrop-blur sm:p-10">
          <div className="inline-flex rounded-full border border-[var(--lp-border)] bg-[var(--lp-badge-bg)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--lp-badge-text)]">
            Review Request
          </div>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-[var(--lp-text)] sm:text-5xl">
              Thanks for riding with us, {derived.firstName || 'there'}.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--lp-text-body)] sm:text-xl">
              If you enjoyed your {derived.rideLabel} experience, a quick review would mean a lot. It helps more riders feel confident booking with Florida Mountain Bike Guides.
            </p>
          </div>

          {detailChips.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {detailChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[var(--lp-border-soft)] bg-[var(--lp-card-solid)] px-3 py-1.5 text-sm text-[var(--lp-text-dark)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          <div className="grid gap-4 rounded-[1.75rem] border border-[var(--lp-border)] bg-[var(--lp-card-solid)] p-6 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--lp-text-muted)]">
                Why it matters
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--lp-text-body)]">
                Your words help future guests understand what the ride actually feels like, not just what it looks like on a website.
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--lp-text-muted)]">
                Takes about
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--lp-text-body)]">
                Most riders finish this in under two minutes. Short and honest is perfect.
              </p>
            </div>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-[var(--lp-border)] bg-[linear-gradient(180deg,rgba(16,38,29,0.98),rgba(22,55,42,0.94))] p-7 text-white shadow-[0_22px_80px_rgba(16,38,29,0.18)] sm:p-10">
          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Next Step
            </div>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
              Leave a Google review
            </h2>
            <p className="text-base leading-7 text-white/72">
              We will send you straight to the review form so you can share your experience without having to search for the business manually.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {derived.reviewHref ? (
              <a
                href={derived.reviewHref}
                className="flex min-h-14 items-center justify-center rounded-full bg-[#16a34a] px-6 text-center text-base font-semibold text-white transition hover:bg-[#15803d]"
              >
                Leave a Google Review
              </a>
            ) : (
              <div className="rounded-[1.5rem] border border-white/15 bg-white/6 p-5 text-sm leading-7 text-white/78">
                Add your Google review link in <code className="rounded bg-black/20 px-1.5 py-0.5 text-white">NEXT_PUBLIC_GOOGLE_REVIEW_URL</code> to activate the main CTA.
              </div>
            )}

            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=I%20need%20help%20with%20my%20ride`}
              className="flex min-h-14 items-center justify-center rounded-full border border-white/20 px-6 text-center text-base font-semibold text-white transition hover:border-white/40 hover:bg-white/8"
            >
              Contact Us Instead
            </a>
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-white/12 bg-white/6 p-5 text-sm leading-7 text-white/72">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
              Helpful Prompt
            </div>
            <p className="mt-3">
              If you&apos;re not sure what to write, a great review can be as simple as mentioning the guide, the trail vibe, and what made the ride feel fun, comfortable, or memorable.
            </p>
            <p className="mt-3 text-white/88">
              Honest, personal, and short is perfect.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

