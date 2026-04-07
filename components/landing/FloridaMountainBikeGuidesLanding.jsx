'use client';

import React from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

// Leaflet requires browser APIs — must be loaded with ssr:false
const InteractiveTrailMap = dynamic(
  () => import('@/components/map/InteractiveTrailMap'),
  { ssr: false, loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-[2rem] border border-[var(--lp-border)] bg-[var(--lp-surface)]">
      <p className="text-sm text-[var(--lp-text-body)]">Loading map…</p>
    </div>
  )}
);
import Image from "next/image";
import {
  ArrowRight,
  Bike,
  Calendar,
  ChevronRight,
  Clock3,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Menu,
  Mountain,
  Route,
  ShieldCheck,
  Star,
  Trees,
  Users,
  Waves,
  X,
  Youtube,
} from "lucide-react";
import { CTAButton } from "@/components/ui/CTAButton";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatCard } from "@/components/ui/StatCard";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { GalleryCarousel } from "@/components/landing/GalleryCarousel";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const valueProps = [
  {
    title: "Everything at the trailhead",
    text: "Quality bikes, essential gear, and a friendly local guide waiting for you when you arrive.",
    icon: Bike,
  },
  {
    title: "For every skill level",
    text: "From first-time riders to seasoned riders, every tour is designed to feel approachable and memorable.",
    icon: ShieldCheck,
  },
  {
    title: "Simple booking experience",
    text: "Choose your location and date, show up ready to ride, and let the adventure begin.",
    icon: Calendar,
  },
  {
    title: "Optional rider pickup",
    text: "Short on time or can't get the car? Pickup and drop-off can be arranged for added convenience.",
    icon: Route,
  },
];

const tours = [
  {
    title: "Mountain Bike Tours",
    badge: "Signature Experience",
    description:
      "Guided mountain bike tours designed for riders of every skill level, focused on making Florida's best trails easy, fun, and unforgettable.",
    icon: Mountain,
    points: ["Guided singletrack", "Bikes & gear included", "Beginner to advanced"],
    cta: "Book a Guide",
  },
  {
    title: "Scenic Paved Trail Tours",
    badge: "Relaxed Adventure",
    description:
      "A laid-back way to explore Central Florida through smooth scenic paved trails, historic Sanford, riverfront views, Blue Spring, and seasonal manatee stops.",
    icon: Waves,
    points: ["Historic Sanford", "Blue Spring rides", "All ages & levels"],
    cta: "Learn More",
  },
];


const guides = [
  {
    title: "Friendly professionals",
    subtitle: "Local knowledge, smoother rides",
    text: "Florida Mountain Bike Guides is built around a team of friendly and professional experts dedicated to making each ride safe, enjoyable, and easy to navigate.",
  },
  {
    title: "Confidence for every rider",
    subtitle: "A better experience from the start",
    text: "Whether someone is brand new to riding or looking for a better local trail experience, the guides help shape the day around skill level and pace.",
  },
  {
    title: "Sunshine State trail insight",
    subtitle: "More than just navigation",
    text: "Their local expertise turns a basic ride into a curated Florida adventure with better flow, less friction, and more memorable moments.",
  },
];

const trailHighlights = [
  {
    title: "Central Florida Trails",
    text: "Explore the Central Florida mountain bike trails proudly offered through guided tours.",
  },
  {
    title: "Sunshine State scenery",
    text: "Riverfront views, springs, local landmarks, and hidden Florida beauty all become part of the experience.",
  },
  {
    title: "Ride-ready logistics",
    text: "The site should make the process feel simple: pick the ride, show up, and enjoy the adventure.",
  },
];

const fleetFeatures = [
  "Specialized Mountain Bikes",
  "Rental Bikes & Electric Bikes",
  "Full-suspension options",
  "Ride-ready setup for visitors",
];

const galleryItems = [
  { title: "Mountain Bike Tours", category: "Singletrack" },
  { title: "Scenic Paved Trails", category: "Riverfront" },
  { title: "Blue Spring Adventure", category: "Nature" },
  { title: "Guided Ride Moments", category: "Experience" },
  { title: "Rental Fleet", category: "Specialized Bikes" },
  { title: "Florida Trail Views", category: "Photo Gallery" },
];


const NAV_LINKS = [
  { href: '#tours',   label: 'Tours'   },
  { href: '#map',     label: 'Map'     },
  { href: '#guides',  label: 'Guides'  },
  { href: '#fleet',   label: 'Fleet'   },
  { href: '#contact', label: 'Contact' },
];

const SOCIAL_LINKS = [
  { href: 'https://www.facebook.com/floridamountainbikeguides', icon: Facebook, label: 'Facebook'  },
  { href: 'https://www.instagram.com/floridamountainbikeguides', icon: Instagram, label: 'Instagram' },
  { href: 'https://www.youtube.com/@floridamountainbikeguides',  icon: Youtube,   label: 'YouTube'   },
  { href: 'mailto:info@fmbgt.com',                               icon: Mail,      label: 'Email'     },
];

export default function FloridaMountainBikeGuidesLanding() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-[var(--lp-bg)] text-[var(--lp-text)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-[24rem] h-[22rem] w-[22rem] rounded-full bg-[#d7c3a1]/35 blur-3xl" />
        <div className="absolute left-[-8rem] top-[58rem] h-[20rem] w-[20rem] rounded-full bg-cyan-200/30 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-[var(--lp-border)] bg-[var(--lp-bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png"
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
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 text-sm text-[var(--lp-text-nav)] md:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <a key={href} href={href} className="transition hover:text-[var(--lp-text)]">{label}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <CTAButton>Book a Guide</CTAButton>
          </div>

          {/* Hamburger button — mobile only */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-60)] text-[var(--lp-green)] transition hover:bg-[var(--lp-card-solid)]"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="border-t border-[var(--lp-border)] bg-[var(--lp-bg)]/95 backdrop-blur-xl md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col px-4 py-4 sm:px-6">
              {NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-[var(--lp-border-soft)] py-3.5 text-sm font-medium text-[var(--lp-text-dark)] transition hover:text-[var(--lp-green)]"
                >
                  {label}
                </a>
              ))}
              <div className="pt-4">
                <CTAButton>Book a Guide</CTAButton>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="relative z-10">

        {/* ══════════════════════════════════════════
            LAYER 1 — Brand Introduction
            Full-width, centered, logo is the hero
        ══════════════════════════════════════════ */}
        <section className="relative overflow-hidden border-b border-[var(--lp-border-soft)] bg-[var(--lp-bg-alt)]">
          {/* Radial glow behind logo */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[480px] w-[480px] rounded-full bg-[var(--lp-green)]/8 blur-3xl" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center sm:py-20"
          >
            {/* ── Large logo ── */}
            <div className="relative mb-7">
              <div className="absolute inset-[-16px] rounded-full bg-[var(--lp-green)]/14 blur-2xl" />
              <div className="absolute inset-[-4px] rounded-full ring-1 ring-[var(--lp-green)]/20" />
              <Image
                src="https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png"
                alt="Florida Mountain Bike Guides logo"
                width={200}
                height={200}
                className="relative rounded-full shadow-[0_20px_70px_rgba(31,90,67,0.28)]"
                priority
              />
            </div>

            {/* ── Brand name ── */}
            <h2 className="text-lg font-black uppercase tracking-[0.22em] text-[var(--lp-green)] sm:text-xl">
              Florida Mountain Bike Guides
            </h2>
            <p className="mt-1.5 text-xs font-medium uppercase tracking-[0.28em] text-[var(--lp-text-muted)]">
              Est. 2024 · Central Florida
            </p>

            {/* ── Tagline ── */}
            <p className="mt-4 text-sm italic leading-relaxed text-[var(--lp-text-body)]">
              "Mountain biking in the land of no mountains"
            </p>

            {/* ── Social icons ── */}
            <div className="mt-7 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-60)] text-[var(--lp-text-body)] backdrop-blur-sm transition hover:border-[var(--lp-green)]/50 hover:bg-[var(--lp-tan)] hover:text-[var(--lp-green)] hover:-translate-y-0.5"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ══════════════════════════════════════════
            LAYER 2 — Hero Content
            Headline, copy, CTAs, feature card
        ══════════════════════════════════════════ */}
        <section className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 sm:pb-24 lg:px-8 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-3xl">
              <motion.div variants={fadeUp} className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--lp-border)] bg-[var(--lp-badge-bg)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--lp-badge-text)]">
                <Star className="h-3.5 w-3.5" />
                Where Adventure Meets Simplicity
              </motion.div>

              <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--lp-green)]">
                Welcome to Florida Mountain Bike Trails
              </motion.p>

              <motion.h1 variants={fadeUp} className="mt-4 text-4xl font-black leading-tight tracking-tight text-[var(--lp-text)] sm:text-5xl lg:text-7xl">
                Mountain biking in the <span className="text-[var(--lp-green)]">land of no mountains</span>
              </motion.h1>

              <motion.p variants={fadeUp} className="mt-6 max-w-2xl text-lg leading-8 text-[var(--lp-text-body)] sm:text-xl">
                Guided mountain bike tours and scenic paved trail rides across Central Florida — with quality bikes, essential gear, and friendly local guides waiting right at the trailhead.
              </motion.p>

              <motion.p variants={fadeUp} className="mt-4 max-w-2xl text-base leading-7 text-[var(--lp-text-body)]">
                Just choose your location and date, show up ready to ride, and let the adventure begin. For riders who need a little extra convenience, pickup and drop-off can also be arranged.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-4 sm:flex-row">
                <CTAButton>Book a Guide</CTAButton>
                <CTAButton secondary href="#tours">Explore Trails</CTAButton>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-10 grid gap-4 sm:grid-cols-3">
                <StatCard title="All skill levels" text="Beginner-friendly rides to more spirited trail sessions." />
                <StatCard title="Guides + rentals" text="A smoother adventure with the right bike and setup." />
                <StatCard title="Florida vibe" text="Springs, riverfronts, local towns, and trail access." />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="relative hidden lg:block"
            >
              <div className="relative overflow-hidden rounded-[2rem] border border-[var(--lp-border)] bg-[linear-gradient(135deg,rgba(31,90,67,0.16),rgba(215,195,161,0.22),rgba(255,255,255,0.55))] p-4 shadow-[0_25px_80px_rgba(16,38,29,0.12)]">
                <div className="aspect-[4/5] rounded-[1.5rem] border border-white/60 bg-[radial-gradient(circle_at_top,_rgba(31,90,67,0.18),_transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.75),rgba(255,255,255,0.45))] p-5">
                  <div className="flex h-full flex-col justify-between rounded-[1.25rem] border border-white/50 bg-[var(--lp-surface)]/85 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-[var(--lp-text-muted)]">Featured Experience</p>
                        <h3 className="mt-2 text-2xl font-bold text-[var(--lp-text)]">Central Florida Trail Adventures</h3>
                      </div>
                      <div className="rounded-2xl bg-[var(--lp-tan)] p-3">
                        <Trees className="h-6 w-6 text-[var(--lp-green)]" />
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className="rounded-3xl border border-white/60 bg-[var(--lp-card-70)] p-4">
                        <div className="flex items-center gap-3 text-sm text-[var(--lp-text-dark)]">
                          <Clock3 className="h-4 w-4 text-[var(--lp-green)]" />
                          Easy to book, easy to show up for, unforgettable to ride.
                        </div>
                      </div>
                      <div className="rounded-3xl border border-white/60 bg-[var(--lp-card-70)] p-4">
                        <div className="flex items-center gap-3 text-sm text-[var(--lp-text-dark)]">
                          <MapPin className="h-4 w-4 text-[var(--lp-green)]" />
                          Sanford, Blue Spring, riverfront routes, and trail access points.
                        </div>
                      </div>
                      <div className="rounded-3xl border border-white/60 bg-[var(--lp-card-70)] p-4">
                        <div className="flex items-center gap-3 text-sm text-[var(--lp-text-dark)]">
                          <Users className="h-4 w-4 text-[var(--lp-green)]" />
                          Friendly guides who make the ride smoother, safer, and more fun.
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-3xl border border-white/60 bg-[var(--lp-card-70)] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--lp-text-muted)]">Tour styles</p>
                        <p className="mt-2 text-3xl font-black text-[var(--lp-text)]">2</p>
                      </div>
                      <div className="rounded-3xl border border-white/60 bg-[var(--lp-card-70)] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--lp-text-muted)]">Vibe</p>
                        <p className="mt-2 text-3xl font-black text-[var(--lp-text)]">Florida</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
          >
            {valueProps.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  variants={fadeUp}
                  className="rounded-[1.75rem] border border-[var(--lp-border)] bg-[var(--lp-card-70)] p-6 backdrop-blur-sm shadow-[0_10px_40px_rgba(16,38,29,0.05)] transition hover:-translate-y-1 hover:bg-[var(--lp-card-solid)]"
                >
                  <div className="mb-4 inline-flex rounded-2xl bg-[var(--lp-tan)] p-3 text-[var(--lp-green)] ring-1 ring-[var(--lp-border-soft)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--lp-text)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--lp-text-body)]">{item.text}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        <section id="tours" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Experiences"
            title="Two ways to experience Florida on two wheels"
            text="The landing is structured around both core offers: guided mountain bike tours for adventure seekers and scenic paved tours for a more relaxed Florida experience."
          />

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="mt-12 grid gap-6 lg:grid-cols-2"
          >
            {tours.map((tour) => {
              const Icon = tour.icon;
              return (
                <motion.div
                  key={tour.title}
                  variants={fadeUp}
                  className="group relative overflow-hidden rounded-[2rem] border border-[var(--lp-border)] bg-[var(--lp-card)] p-8 backdrop-blur-sm shadow-[0_15px_50px_rgba(16,38,29,0.06)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-[#d9c6a6]/10 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-4">
                      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--lp-badge-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lp-badge-text)]">
                        {tour.badge}
                      </div>
                      <div className="rounded-2xl bg-[var(--lp-tan)] p-3 ring-1 ring-[var(--lp-border-soft)]">
                        <Icon className="h-6 w-6 text-[var(--lp-green)]" />
                      </div>
                    </div>
                    <h3 className="mt-6 text-2xl font-bold text-[var(--lp-text)] sm:text-3xl">{tour.title}</h3>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--lp-text-body)]">{tour.description}</p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {tour.points.map((point) => (
                        <div key={point} className="rounded-2xl border border-[var(--lp-border-soft)] bg-[var(--lp-card-light)] px-4 py-3 text-sm text-[var(--lp-text-dark)]">
                          {point}
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 flex justify-center sm:justify-start">
                      <a href="/booking" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--lp-green)] transition hover:text-[var(--lp-green-dark)]">
                        {tour.cta}
                        <ChevronRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        <section id="map" className="border-y border-[var(--lp-border)] bg-[var(--lp-bg-alt)]">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Interactive Map"
              title="Explore Our Central Florida Trails"
              text="Discover where your next ride begins. Our guided tours take you through some of Central Florida's most scenic routes—from riverfront paths in historic Sanford to nature-filled trails near Blue Spring and beyond. Use the map to explore locations, see trail highlights, and find the perfect ride for your adventure. 🚵‍♂️"
            />

            <div className="mt-12">
              <InteractiveTrailMap />
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--lp-border)] bg-[var(--lp-bg-alt)]">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Photo Gallery"
              title="Trail Moments & Florida Ride Experiences"
              text="A glimpse into the rides, landscapes, and unforgettable moments that make every tour unique. From shaded singletrack and scenic riverfront paths to crystal-clear springs and friendly trail stops, these photos capture the spirit of riding Central Florida with Florida Mountain Bike Guides."
            />

            <div className="mt-12 px-5">
              <GalleryCarousel items={galleryItems} />
            </div>
          </div>
        </section>

        <section id="guides" className="border-y border-[var(--lp-border)] bg-[var(--lp-bg-alt)]">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Guides"
              title="Your guide — friendly, local, and ready to ride"
              text="Florida Mountain Bike Guides is built around friendly and professional expertise dedicated to making each ride safe, enjoyable, and easy to navigate for every skill level."
            />

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7 }}
              className="mt-12 overflow-hidden rounded-[2rem] border border-[var(--lp-border)] bg-[var(--lp-card)] shadow-[0_12px_40px_rgba(16,38,29,0.04)] lg:flex"
            >
              <div className="h-64 shrink-0 bg-[linear-gradient(135deg,rgba(31,90,67,0.18),rgba(215,195,161,0.22),rgba(117,196,210,0.12))] lg:h-auto lg:w-80" />
              <div className="p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--lp-badge-text)]">Guide Profile</p>
                <h3 className="mt-3 text-2xl font-bold text-[var(--lp-text)]">{guides[0].title}</h3>
                <p className="mt-2 text-sm font-medium text-[var(--lp-text-nav)]">{guides[0].subtitle}</p>
                <p className="mt-4 text-sm leading-7 text-[var(--lp-text-body)]">{guides[0].text}</p>
                <a href="/booking" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--lp-green)] transition hover:text-[var(--lp-green-dark)]">
                  Book a ride
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="fleet" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7 }}
            >
              <SectionHeading
                eyebrow="Rental Fleet"
                title="Specialized bikes and a local bike shop partner riders can trust"
                text="We're proud to partner with Bicikleta Bike Shop in Sanford, giving riders access to full-suspension mountain bikes and e-bikes, along with the welcoming charm of a trusted local bike shop that complements our guided tour experience."
              />
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {fleetFeatures.map((item) => (
                  <div key={item} className="rounded-2xl border border-[var(--lp-border-soft)] bg-[var(--lp-card-70)] px-4 py-4 text-sm text-[var(--lp-text-dark)] shadow-[0_8px_25px_rgba(16,38,29,0.03)]">
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7 }}
              className="rounded-[2rem] border border-[var(--lp-border)] bg-[var(--lp-card-70)] p-5 shadow-[0_18px_60px_rgba(16,38,29,0.06)]"
            >
              <div className="rounded-[1.5rem] border border-[var(--lp-border-soft)] bg-[var(--lp-card-light)] p-6">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--lp-text-muted)]">Bike shop</p>
                <h3 className="mt-2 text-xl font-bold text-[var(--lp-text)]">Bicikleta, Sanford FL</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--lp-text-body)]">
                  A local shop experience that supports riders who want premium bike rentals without the extra hassle.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7 }}
            className="overflow-hidden rounded-[2.25rem] border border-[#d5c4a8] bg-[linear-gradient(135deg,rgba(31,90,67,0.95),rgba(39,92,70,0.88),rgba(194,165,120,0.78))] p-8 shadow-[0_22px_70px_rgba(16,38,29,0.12)] sm:p-10"
          >
            <div className="max-w-4xl">
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#f7eddb]">
                Ready to Ride?
              </p>
              <h2 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                Ready to Ride?
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
                Choose your trail, meet your guide, and experience the best of Central Florida on two wheels. From scenic paved rides to guided mountain bike adventures, we make it easy to show up, ride, and enjoy the journey.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a href="/booking" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f7efdf] px-5 py-3 text-sm font-semibold text-[var(--lp-green-dark)] transition hover:-translate-y-0.5 hover:bg-[var(--lp-card-solid)]">
                  Book a Tour
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a href="#guides" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
                  Meet Our Guides
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="contact" className="border-t border-[var(--lp-border)] bg-[var(--lp-surface)]">
          <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Get In Touch"
              title="Get in Touch"
              text="Have questions or ready to plan your ride? Reach out and we'll help you choose the right tour, answer any details, and get you set for an unforgettable Central Florida biking experience."
            />

            <div className="mt-10 rounded-[2rem] border border-[var(--lp-border)] bg-[var(--lp-card-80)] p-6 shadow-[0_16px_50px_rgba(16,38,29,0.05)] sm:p-8">
              <form className="grid gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--lp-text-dark)]">Name</label>
                    <input
                      type="text"
                      placeholder="Your name"
                      className="w-full rounded-2xl border border-[var(--lp-border-soft)] bg-[var(--lp-surface)] px-4 py-3 text-[var(--lp-text)] outline-none placeholder:text-[var(--lp-text-muted)] focus:border-[var(--lp-green)]/40"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--lp-text-dark)]">Email</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      className="w-full rounded-2xl border border-[var(--lp-border-soft)] bg-[var(--lp-surface)] px-4 py-3 text-[var(--lp-text)] outline-none placeholder:text-[var(--lp-text-muted)] focus:border-[var(--lp-green)]/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--lp-text-dark)]">Phone Number (optional)</label>
                  <input
                    type="text"
                    placeholder="(555) 555-5555"
                    className="w-full rounded-2xl border border-[var(--lp-border-soft)] bg-[var(--lp-surface)] px-4 py-3 text-[var(--lp-text)] outline-none placeholder:text-[var(--lp-text-muted)] focus:border-[var(--lp-green)]/40"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--lp-text-dark)]">Questions?</label>
                  <textarea
                    rows={5}
                    placeholder="Tell us about your ideal ride, your skill level, or the type of tour you're looking for."
                    className="w-full rounded-2xl border border-[var(--lp-border-soft)] bg-[var(--lp-surface)] px-4 py-3 text-[var(--lp-text)] outline-none placeholder:text-[var(--lp-text-muted)] focus:border-[var(--lp-green)]/40"
                  />
                </div>

                <div className="pt-2 flex justify-center sm:justify-start">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--lp-green)] px-5 py-3 text-sm font-semibold text-[var(--lp-surface)] transition hover:-translate-y-0.5 hover:bg-[var(--lp-green-dark)]"
                  >
                    Submit
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-[var(--lp-border)] bg-[var(--lp-bg-alt)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-[var(--lp-text-muted)] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© Florida Mountain Bike Guides LLC — Redesign concept landing page.</p>
          <div className="flex flex-wrap gap-5">
            <a href="#tours" className="transition hover:text-[var(--lp-text)]">Mountain bike tours</a>
            <a href="#guides" className="transition hover:text-[var(--lp-text)]">Meet Our Guides</a>
            <a href="#fleet" className="transition hover:text-[var(--lp-text)]">Rental Fleet</a>
            <a href="/booking" className="transition hover:text-[var(--lp-text)]">Book a Tour</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
