import Image from 'next/image';
import Link from 'next/link';
import { CITIES } from '@/data/cities';
import { MTB_TRAILS, PAVED_TRAILS } from '@/data/trails';

/**
 * Header and footer for the content pages (/tours, /trails, /guides).
 *
 * The footer is deliberately link-heavy: before this existed the entire site
 * navigated by in-page anchors (#tours, #map, #guides), so nothing but the
 * homepage and /booking had a crawl path. These links are what let the city
 * and trail pages be discovered and pass authority between each other.
 */

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--lp-border)] bg-[var(--lp-bg)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
        >
          <Image
            src="/images/branding/logo fmbtg (800 x 800 px).png"
            alt="Florida Mountain Bike Guides"
            width={44}
            height={44}
            className="object-contain"
          />
          <span className="text-sm font-bold leading-tight text-[var(--lp-text)] sm:text-base">
            Florida Mountain Bike Guides
          </span>
        </Link>

        <Link
          href="/booking"
          className="rounded-full bg-[var(--lp-green)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--lp-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)] focus-visible:ring-offset-2"
        >
          Book a Tour
        </Link>
      </div>
    </header>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--lp-text-muted)]">
        {title}
      </h2>
      <ul className="mt-4 flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-[var(--lp-text-body)] underline-offset-4 transition hover:text-[var(--lp-green)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
      >
        {children}
      </Link>
    </li>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--lp-border)] bg-[var(--lp-bg-alt)]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn title="Tours by area">
            {CITIES.map((city) => (
              <FooterLink key={city.slug} href={`/tours/${city.slug}`}>
                Bike tours in {city.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Mountain bike trails">
            {MTB_TRAILS.map((trail) => (
              <FooterLink key={trail.slug} href={`/trails/${trail.slug}`}>
                {trail.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Paved trail rides">
            {PAVED_TRAILS.map((trail) => (
              <FooterLink key={trail.slug} href={`/trails/${trail.slug}`}>
                {trail.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Ride guides">
            <FooterLink href="/guides/central-florida-mountain-bike-trails">
              Every Central Florida trail, compared
            </FooterLink>
            <FooterLink href="/guides/beginner-mountain-biking-orlando">
              Beginner mountain biking near Orlando
            </FooterLink>
            <FooterLink href="/guides/blue-spring-manatee-bike-tour">
              Blue Spring manatee season by bike
            </FooterLink>
            <FooterLink href="/booking">Book a tour</FooterLink>
            <FooterLink href="/booking/lookup">Find my booking</FooterLink>
          </FooterColumn>
        </div>

        <p className="mt-12 border-t border-[var(--lp-border)] pt-6 text-xs text-[var(--lp-text-muted)]">
          Florida Mountain Bike Guides &mdash; guided mountain bike and paved trail tours
          across Central Florida. Bikes, helmets and local guides included.
        </p>
      </div>
    </footer>
  );
}
