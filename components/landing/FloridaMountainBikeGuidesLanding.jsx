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
  ChevronLeft,
  ChevronRight,
  Clock3,
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
} from "lucide-react";
import { CTAButton } from "@/components/ui/CTAButton";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatCard } from "@/components/ui/StatCard";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  trackCtaClick,
  trackContactFormSubmit,
  trackSocialClick,
  trackBookingStart,
} from "@/lib/analytics";

function FacebookIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  );
}

function InstagramIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function YoutubeIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58a2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/>
    </svg>
  );
}

// Threads has no lucide icon — minimal inline SVG matching the official mark
function ThreadsIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.878-6.43 2.523-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.594 12c.022 3.087.713 5.495 2.052 7.163 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.749-1.752-2.982-.065-1.232.448-2.35 1.44-3.154.905-.733 2.184-1.175 3.738-1.313.383-.034.793-.056 1.228-.067-.083-.49-.218-.895-.407-1.207-.43-.713-1.13-1.074-2.085-1.074h-.049c-.707.007-1.951.199-2.97 1.32l-1.492-1.32c1.417-1.602 3.231-2.148 4.474-2.155h.067c1.582 0 2.877.614 3.736 1.773.677.913 1.063 2.174 1.148 3.754.53.309.999.663 1.396 1.063 1.086 1.1 1.637 2.534 1.548 4.04-.107 1.79-.862 3.442-2.125 4.665-1.524 1.476-3.575 2.226-6.094 2.246zM12.5 13.93c-.461.01-.876.033-1.242.067-1.053.093-1.875.38-2.333.756-.44.358-.657.838-.622 1.352.038.708.447 1.253 1.16 1.716.55.356 1.27.538 2.083.494 1.154-.062 2.011-.499 2.622-1.336.527-.72.836-1.731.92-3.01-.215-.024-.383-.039-.588-.039z"/>
    </svg>
  );
}

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
    image: "/images/skills/skill-first-time-rider.png",
    alt: "A first-time rider getting comfortable on a guided Florida trail ride",
    objectPosition: "center center",
  },
  {
    title: "For every skill level",
    text: "From first-time riders to seasoned riders, every tour is designed to feel approachable and memorable.",
    icon: ShieldCheck,
    image: "/images/skills/skill-beginner.png",
    alt: "Beginner-friendly coaching on a welcoming mountain bike ride in Florida",
    objectPosition: "center center",
  },
  {
    title: "Simple booking experience",
    text: "Choose your location and date, show up ready to ride, and let the adventure begin.",
    icon: Calendar,
    image: "/images/gallery/gallery-1.png",
    alt: "Group of riders gathered together before a Florida mountain bike tour",
    objectPosition: "center center",
  },
  {
    title: "Optional rider pickup",
    text: "Short on time or can't get the car? Pickup and drop-off can be arranged for added convenience.",
    icon: Route,
    image: "/images/hero/hero-main.png",
    alt: "Guided rider on trail representing an easy, ready-to-go Florida bike experience",
    objectPosition: "center center",
  },
];

const tours = [
  {
    title: "Mountain Bike Tours",
    badge: "Signature Experience",
    description:
      "Guided mountain bike tours designed for riders of every skill level, focused on making Florida's best trails easy, fun, and unforgettable.",
    icon: Mountain,
    duration: "2-hour guided tour",
    price: "From $115 / rider",
    includes: ["Bike & helmet", "Local guide", "All skill levels"],
    points: ["Guided singletrack", "Bikes & gear included", "Beginner to advanced"],
    cta: "Book a Guide",
    image: "/images/gallery/gallery-4.png",
    alt: "Group riders enjoying a guided trail experience together on a Florida mountain bike tour",
    objectPosition: "center center",
  },
  {
    title: "Scenic Paved Trail Tours",
    badge: "Relaxed Adventure",
    description:
      "A laid-back way to explore Central Florida through smooth scenic paved trails, historic Sanford, riverfront views, Blue Spring, and seasonal manatee stops.",
    icon: Waves,
    duration: "2–3 hour guided tour",
    price: "From $115 / rider",
    includes: ["Bike & helmet", "Local guide", "All ages welcome"],
    points: ["Historic Sanford", "Blue Spring rides", "All ages & levels"],
    cta: "Book This Tour",
    image: "/images/tours/location-spring-to-spring.png",
    alt: "Scenic paved trail ride near Florida springs with water and nature views",
    objectPosition: "center center",
  },
];


const guides = [
  {
    title: "Friendly professionals",
    subtitle: "Local guide. MTB expertise. Scenic Florida rides.",
    text: "Ride with Dustin, an experienced local guide specializing in guided mountain bike tours and scenic paved rides across Central Florida. Known for his patience, trail knowledge, and ability to adapt to all skill levels, Dustin creates smooth, safe, and unforgettable experiences for every rider.",
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

const testimonials = [
  {
    quote: "Best thing we did during our Florida vacation. The guide knew every trail and made the whole experience incredibly easy and fun.",
    name: "Sarah M.",
    location: "Visited from Atlanta, GA",
  },
  {
    quote: "I hadn't ridden a bike in years. The guide was patient, the trails were beautiful, and I ended up doing way more than I expected.",
    name: "James R.",
    location: "Orlando, FL",
  },
  {
    quote: "Did the paved trail tour near Blue Spring with my kids. Saw manatees, learned about the area — one of our best days in Florida.",
    name: "Linda T.",
    location: "Sanford, FL",
  },
];

const whatToExpect = [
  {
    step: "01",
    title: "Arrive at the trailhead",
    desc: "Show up at the meeting point — we'll have everything ready when you get there. No gear needed.",
  },
  {
    step: "02",
    title: "Meet your guide",
    desc: "Your guide introduces themselves, learns your skill level, and sets the tone for a comfortable, enjoyable ride.",
  },
  {
    step: "03",
    title: "Get fitted and geared up",
    desc: "We fit you for your bike and helmet and make sure everything feels right before you roll out.",
  },
  {
    step: "04",
    title: "Hit the trail",
    desc: "Follow your guide at a comfortable pace. Ask questions, take in the scenery, and enjoy the ride.",
  },
  {
    step: "05",
    title: "Wrap up and head out",
    desc: "Finish at the trailhead with great memories. Ask about upcoming tours or book your next ride on the spot.",
  },
];

const faqItems = [
  {
    q: "Do I need to bring my own bike?",
    a: "You can, but you don't have to. We offer a Bring Your Own Bike (BYOB) option if you prefer riding your own setup. For the best experience, many riders choose our ready-to-ride fleet, including high-quality mountain bikes and e-bikes. It's a convenient way to enjoy the trail without worrying about setup or transport.",
  },
  {
    q: "Are the tours beginner-friendly?",
    a: "Absolutely. Tours are designed for all skill levels, from complete beginners to experienced riders. Your guide shapes the pace and trail choice around your comfort level.",
  },
  {
    q: "How long are the tours?",
    a: "Most mountain bike tours run approximately 2 hours. Scenic paved trail tours may run 2–3 hours depending on the route and group pace.",
  },
  {
    q: "What should I wear or bring?",
    a: "Wear comfortable athletic clothing and closed-toe shoes suitable for biking. We recommend bringing water to stay hydrated, a light snack for energy, and sunscreen for Florida's sun. If you choose a rental, your bike and helmet will be provided and ready at the trailhead. If you're bringing your own bike (BYOB), just make sure it's in good working condition and ready to ride.",
  },
  {
    q: "What happens if it rains or weather turns bad?",
    a: "Light rain is usually fine for trail riding. For the safety of the group, tours may be rescheduled in the event of lightning or severe weather. We'll reach out in advance if conditions require a change.",
  },
  {
    q: "Can you arrange pickup from my hotel or Airbnb?",
    a: "Yes. Pickup and drop-off can be arranged for select locations. Contact us when booking to confirm availability and any additional logistics.",
  },
  {
    q: "Are tours suitable for families and kids?",
    a: "Yes. Our scenic paved trail tours are especially popular with families and younger riders. Mountain bike tours can also be adapted for younger participants depending on fitness and comfort level.",
  },
  {
    q: "How do I book, and what is the cancellation policy?",
    a: "Book online in just a few minutes. Free cancellation is available up to 24 hours before your scheduled tour. Contact us directly for any last-minute adjustments.",
  },
];

const galleryItems = [
  {
    title: "Mountain Bike Tours",
    category: "Singletrack",
    image: "/images/gallery/gallery-1.png",
    alt: "Mountain bikers riding a guided singletrack tour in Central Florida",
    objectPosition: "center center",
  },
  {
    title: "Scenic Paved Trails",
    category: "Riverfront",
    image: "/images/gallery/gallery-2.png",
    alt: "Relaxed scenic paved trail ride near the riverfront in Florida",
    objectPosition: "center center",
  },
  {
    title: "Blue Spring Adventure",
    category: "Nature",
    image: "/images/gallery/gallery-3.png",
    alt: "Nature-focused guided ride experience in Central Florida",
    objectPosition: "center center",
  },
  {
    title: "Guided Ride Moments",
    category: "Experience",
    image: "/images/gallery/gallery-4.png",
    alt: "Group riders enjoying a guided trail experience together",
    objectPosition: "center center",
  },
  {
    title: "Rental Fleet",
    category: "Specialized Bikes",
    image: "/images/gallery/gallery-6.png",
    alt: "Premium rental bikes prepared for a guided Florida ride",
    objectPosition: "center center",
  },
  {
    title: "Florida Trail Views",
    category: "Landscape",
    image: "/images/gallery/gallery-7.png",
    alt: "Florida trail scenery during a guided outdoor bike adventure",
    objectPosition: "center center",
  },
  {
    title: "Ride Together",
    category: "Lifestyle",
    image: "/images/gallery/gallery-8.png",
    alt: "Riders sharing a guided outdoor biking experience in Florida",
    objectPosition: "center center",
  },
  {
    title: "Close-Up Trail Energy",
    category: "Action",
    image: "/images/gallery/gallery-9.png",
    alt: "Close-up trail action from a Florida mountain bike tour",
    objectPosition: "center center",
  },
];

const logoSrc = "/images/branding/logo fmbtg (800 x 800 px).png";

const trailShowcase = [
  {
    title: "Mountain bike terrain",
    image: "/images/gallery/gallery-9.png",
    alt: "Mountain biker riding technical Florida terrain with dynamic trail action",
    objectPosition: "center center",
  },
  {
    title: "Paved trail terrain",
    image: "/images/trails/trail-type-paved-2.png",
    alt: "Scenic paved trail terrain in Central Florida",
    objectPosition: "center center",
  },
];


const NAV_LINKS = [
  { href: '#tours',   label: 'Tours'   },
  { href: '#map',     label: 'Map'     },
  { href: '#guides',  label: 'Guides'  },
  { href: '#fleet',   label: 'Fleet'   },
  { href: '#contact', label: 'Contact' },
];

const SOCIAL_LINKS = [
  { href: 'https://www.facebook.com/floridamountainbikeguides',   icon: FacebookIcon,   ariaLabel: 'Visit Facebook page',   platform: 'facebook'   },
  { href: 'https://www.instagram.com/FloridaMountainBikeGuides',  icon: InstagramIcon,  ariaLabel: 'Visit Instagram page',  platform: 'instagram'  },
  { href: 'https://www.threads.com/@floridamountainbikeguides',   icon: ThreadsIcon,    ariaLabel: 'Visit Threads page',    platform: 'threads'    },
  { href: 'https://www.youtube.com/@FloridaMountainBikeGuides',   icon: YoutubeIcon,    ariaLabel: 'Visit YouTube channel', platform: 'youtube'    },
];

export default function FloridaMountainBikeGuidesLanding() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeGallerySlide, setActiveGallerySlide] = React.useState(0);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveGallerySlide((current) => (current + 1) % galleryItems.length);
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, []);

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
              src={logoSrc}
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
            <CTAButton
              trackLocation="nav"
              onClick={() => { trackCtaClick('Book a Guide', 'nav'); trackBookingStart('nav'); }}
            >Book a Guide</CTAButton>
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
                <CTAButton
                  trackLocation="mobile_menu"
                  onClick={() => { trackCtaClick('Book a Guide', 'mobile_menu'); trackBookingStart('mobile_menu'); }}
                >Book a Guide</CTAButton>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="relative z-10">

        {/* ══════════════════════════════════════════
            LAYER 1 — Brand Introduction
            Logo is the absolute focal point
        ══════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-[var(--lp-bg-alt)]">
          <div className="absolute inset-0">
            <Image
              src="/images/hero/hero-main.png"
              alt="A guided Florida mountain bike ride with rider and bike visible on trail"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(247,244,235,0.55),rgba(247,244,235,0.78)_26%,rgba(247,244,235,0.92)_58%,rgba(247,244,235,0.98))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(31,90,67,0.14),transparent_34%)]" />
          </div>
          {/* Multi-layer radial glow — large ambient + tighter halo */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="absolute h-[700px] w-[700px] rounded-full bg-[var(--lp-green)]/5 blur-[120px]" />
            <div className="absolute h-[380px] w-[380px] rounded-full bg-[var(--lp-green)]/9 blur-[70px]" />
            <div className="absolute h-[180px] w-[180px] rounded-full bg-emerald-400/8 blur-[40px]" />
          </div>

          {/* Gradient dissolve into the hero section below — no hard cut */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-b from-transparent to-[var(--lp-bg)]" />

          <div className="relative mx-auto flex flex-col items-center px-6 py-20 text-center sm:py-28">

            {/* ── Logo — dominant focal point ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
              className="relative mb-9"
            >
              {/* Outermost ambient halo */}
              <div className="absolute inset-[-32px] rounded-full bg-[var(--lp-green)]/10 blur-3xl" />
              {/* Mid glow */}
              <div className="absolute inset-[-12px] rounded-full bg-[var(--lp-green)]/12 blur-xl" />
              {/* Tight ring */}
              <div className="absolute inset-[-2px] rounded-full ring-1 ring-[var(--lp-green)]/18" />
              <Image
                src={logoSrc}
                alt="Florida Mountain Bike Guides logo"
                width={340}
                height={340}
                style={{ width: 'clamp(220px, 38vw, 340px)', height: 'auto' }}
                className="relative rounded-full shadow-[0_32px_90px_rgba(31,90,67,0.30),_0_8px_28px_rgba(31,90,67,0.16)]"
                priority
              />
            </motion.div>

            {/* ── Brand name — decorative, not a document heading ── */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.38, ease: 'easeOut' }}
              className="text-xl font-black uppercase tracking-[0.22em] text-[var(--lp-green)] sm:text-2xl"
            >
              Florida Mountain Bike Guides
            </motion.p>

            {/* ── Est / location ── */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.52, ease: 'easeOut' }}
              className="mt-2 text-xs font-medium uppercase tracking-[0.30em] text-[var(--lp-text-muted)]"
            >
              Est. 2024 · Central Florida
            </motion.p>

            {/* ── Tagline ── */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.68 }}
              className="mt-5 max-w-xs text-sm italic leading-relaxed text-[var(--lp-text-body)] sm:max-w-sm"
            >
              "Mountain biking in the land of no mountains"
            </motion.p>

            {/* ── Social icons + micro-copy ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.84, ease: 'easeOut' }}
              className="mt-8 flex flex-col items-center gap-4"
            >
              <p className="text-xs tracking-wide text-[var(--lp-text-muted)]">
                Follow us for trail updates, rides, and local insights.
              </p>
              <div className="flex items-center gap-3">
                {SOCIAL_LINKS.map(({ href, icon: Icon, ariaLabel, platform }) => (
                  <a
                    key={ariaLabel}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={ariaLabel}
                    data-track="social_click"
                    data-platform={platform}
                    onClick={() => trackSocialClick(platform)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-60)] text-[var(--lp-text-body)] backdrop-blur-sm transition hover:scale-105 hover:border-[var(--lp-green)]/50 hover:bg-[var(--lp-tan)] hover:text-[var(--lp-green)]"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </motion.div>

          </div>
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
                Guided Mountain Bike Tours in <span className="text-[var(--lp-green)]">Central Florida</span>
              </motion.h1>

              <motion.p variants={fadeUp} className="mt-3 text-base italic text-[var(--lp-text-muted)]">
                "Mountain biking in the land of no mountains"
              </motion.p>

              <motion.p variants={fadeUp} className="mt-6 max-w-2xl text-lg leading-8 text-[var(--lp-text-body)] sm:text-xl">
                Guided mountain bike tours and scenic paved trail rides across Central Florida — with quality bikes, essential gear, and friendly local guides waiting right at the trailhead.
              </motion.p>

              <motion.p variants={fadeUp} className="mt-4 max-w-2xl text-base leading-7 text-[var(--lp-text-body)]">
                Just choose your location and date, show up ready to ride, and let the adventure begin. For riders who need a little extra convenience, pickup and drop-off can also be arranged.
              </motion.p>

              <motion.p variants={fadeUp} className="mt-3 text-sm text-[var(--lp-text-muted)]">
                Serving riders across Orlando, Sanford, Mount Dora, DeLand, Ocala, and Palm Coast.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-4 sm:flex-row">
                <CTAButton
                  trackLocation="hero"
                  onClick={() => { trackCtaClick('Book a Guide', 'hero'); trackBookingStart('hero'); }}
                >Book a Guide</CTAButton>
                <CTAButton secondary href="#tours" trackLocation="hero"
                  onClick={() => trackCtaClick('Explore Trails', 'hero')}
                >Explore Trails</CTAButton>
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
                <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] border border-white/60 bg-[radial-gradient(circle_at_top,_rgba(31,90,67,0.18),_transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.75),rgba(255,255,255,0.45))] p-5">
                  <Image
                    src="/images/tours/location-downtown-sanford.png"
                    alt="A relaxed guided bike ride through historic downtown Sanford"
                    fill
                    sizes="(min-width: 1024px) 34vw, 100vw"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(247,244,235,0.22),rgba(247,244,235,0.74)_58%,rgba(247,244,235,0.92))]" />
                  <div className="relative z-10 flex h-full flex-col justify-between rounded-[1.25rem] border border-white/50 bg-[var(--lp-surface)]/85 p-5">
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

        <section id="experiences" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
              className="relative grid gap-5 md:grid-cols-2 xl:grid-cols-4"
            >
              {valueProps.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    variants={fadeUp}
                    className="sticky overflow-hidden rounded-[1.75rem] border border-[var(--lp-border)] bg-[var(--lp-card-70)] backdrop-blur-sm shadow-[0_10px_40px_rgba(16,38,29,0.05)] transition hover:-translate-y-1 hover:bg-[var(--lp-card-solid)] md:static"
                    style={{
                      top: `${88 + index * 18}px`,
                      zIndex: index + 1,
                    }}
                  >
                  {item.image && (
                    <div className="relative h-44 overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.alt}
                        fill
                        sizes="(min-width: 1280px) 22vw, (min-width: 768px) 45vw, 100vw"
                        className="object-cover"
                        style={{ objectPosition: item.objectPosition }}
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,29,0.04),rgba(16,38,29,0.2))]" />
                    </div>
                  )}
                  <div className="p-6">
                    <div className="mb-4 inline-flex rounded-2xl bg-[var(--lp-tan)] p-3 text-[var(--lp-green)] ring-1 ring-[var(--lp-border-soft)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--lp-text)]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--lp-text-body)]">{item.text}</p>
                  </div>
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
            className="relative mt-12 lg:grid lg:grid-cols-2 lg:gap-6"
          >
            {tours.map((tour, index) => {
              const Icon = tour.icon;
              return (
                <motion.div
                  key={tour.title}
                  variants={fadeUp}
                  className="relative"
                >
                  <div
                    className="group overflow-hidden rounded-[2rem] border border-[var(--lp-border)] bg-[var(--lp-card)] backdrop-blur-sm shadow-[0_15px_50px_rgba(16,38,29,0.06)]"
                    style={{
                      zIndex: index + 1,
                    }}
                  >
                    <div className="relative h-64 overflow-hidden">
                      <Image
                        src={tour.image}
                        alt={tour.alt}
                        fill
                        sizes="(min-width: 1024px) 44vw, 100vw"
                        className="object-cover transition duration-700 group-hover:scale-105"
                        style={{ objectPosition: tour.objectPosition }}
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,29,0.08),rgba(16,38,29,0.34))]" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-[#d9c6a6]/10 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
                    <div className="relative z-10 p-8">
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

                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.4rem] border border-[var(--lp-border-soft)] bg-[var(--lp-card-light)] px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--lp-text-muted)]">Duration</p>
                          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-[var(--lp-text-dark)]">
                            <Clock3 className="h-4 w-4 text-[var(--lp-green)]" />
                            <span>{tour.duration}</span>
                          </div>
                        </div>
                        <div className="rounded-[1.4rem] border border-[var(--lp-border-soft)] bg-[var(--lp-card-light)] px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--lp-text-muted)]">Starting at</p>
                          <p className="mt-2 text-sm font-medium text-[var(--lp-text-dark)]">{tour.price}</p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--lp-text-muted)]">What's included</p>
                        <div className="mt-3 flex flex-wrap gap-2.5">
                          {tour.includes.map((item) => (
                            <span
                              key={item}
                              className="inline-flex rounded-full border border-[var(--lp-border-soft)] bg-[var(--lp-card-light)] px-3.5 py-2 text-sm text-[var(--lp-text-dark)]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

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
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        <section id="map" className="relative overflow-hidden border-y border-[var(--lp-border)] bg-[var(--lp-bg-alt)]">
          <div className="absolute inset-0 opacity-20">
            <Image
              src="/images/booking/trail-type-paved.png"
              alt="Scenic paved trail background texture"
              fill
              sizes="100vw"
              className="object-cover object-center"
            />
          </div>
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Interactive Map"
              title="Explore Our Central Florida Trails"
              text="Discover where your next ride begins. Our guided tours cover trails from Orlando and Sanford to Mount Dora, DeLand, Ocala, and Palm Coast — riverfront paths, shaded singletrack, and scenic nature rides across Central Florida. Use the map to explore locations and find the perfect ride for your adventure."
            />

            <div className="relative mt-12 grid gap-5 md:grid-cols-2">
              {trailShowcase.map((item) => (
                <div key={item.title} className="relative overflow-hidden rounded-[1.75rem] border border-[var(--lp-border)] bg-[var(--lp-card-70)]">
                  <div className="relative h-48">
                    <Image
                      src={item.image}
                      alt={item.alt}
                      fill
                      sizes="(min-width: 768px) 44vw, 100vw"
                      className="object-cover"
                      style={{ objectPosition: item.objectPosition }}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,29,0.06),rgba(16,38,29,0.38))]" />
                  </div>
                  <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/25 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                    {item.title}
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-6">
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

            <div className="mt-12 sm:hidden">
              <div className="relative overflow-hidden rounded-[1.75rem]">
                <div
                  className="flex transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${activeGallerySlide * 100}%)` }}
                >
                  {galleryItems.map((item) => (
                    <div
                      key={item.title}
                      className="group w-full shrink-0 overflow-hidden rounded-[1.75rem] border border-[var(--lp-border)] bg-[var(--lp-card)] shadow-[0_12px_40px_rgba(16,38,29,0.06)]"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden">
                        <Image
                          src={item.image}
                          alt={item.alt}
                          fill
                          sizes="100vw"
                          className="object-cover"
                          style={{ objectPosition: item.objectPosition }}
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,29,0.02),rgba(16,38,29,0.5))]" />
                        <div className="absolute left-4 top-4 rounded-full border border-white/25 bg-black/25 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-sm">
                          {item.category}
                        </div>
                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="text-lg font-bold text-white">{item.title}</h3>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  aria-label="Previous gallery slide"
                  onClick={() =>
                    setActiveGallerySlide((current) =>
                      current === 0 ? galleryItems.length - 1 : current - 1
                    )
                  }
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/45"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  aria-label="Next gallery slide"
                  onClick={() =>
                    setActiveGallerySlide((current) => (current + 1) % galleryItems.length)
                  }
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/45"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 flex justify-center gap-2">
                {galleryItems.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    aria-label={`Go to gallery slide ${index + 1}`}
                    onClick={() => setActiveGallerySlide(index)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      activeGallerySlide === index
                        ? "w-7 bg-[var(--lp-green)]"
                        : "w-2.5 bg-[var(--lp-border)]"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-12 hidden gap-5 sm:grid lg:grid-cols-4">
              {galleryItems.map((item) => (
                <div
                  key={item.title}
                  className="group overflow-hidden rounded-[1.75rem] border border-[var(--lp-border)] bg-[var(--lp-card)] shadow-[0_12px_40px_rgba(16,38,29,0.06)]"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.alt}
                      fill
                      sizes="(min-width: 1024px) 22vw, (min-width: 640px) 44vw, 100vw"
                      className="object-cover transition duration-700 group-hover:scale-105 group-hover:brightness-105"
                      style={{ objectPosition: item.objectPosition }}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,29,0.02),rgba(16,38,29,0.5))]" />
                    <div className="absolute left-4 top-4 rounded-full border border-white/25 bg-black/25 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-sm">
                      {item.category}
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-lg font-bold text-white">{item.title}</h3>
                    </div>
                  </div>
                </div>
              ))}
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
              <div className="shrink-0 p-4 lg:w-[24rem]">
                <div className="relative h-64 overflow-hidden rounded-[1.5rem] border border-[var(--lp-border-soft)] lg:h-auto lg:min-h-[20rem]">
                  <Image
                    src="/images/guides/tour-guide-dustin.png"
                    alt="Local Florida Mountain Bike Guides guide ready to lead riders on trail"
                    fill
                    sizes="(min-width: 1024px) 24rem, 100vw"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,29,0.06),rgba(16,38,29,0.28))]" />
                </div>
              </div>
              <div className="p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--lp-badge-text)]">Guide Profile</p>
                <h3 className="mt-3 text-2xl font-bold text-[var(--lp-text)]">{guides[0].title}</h3>
                <p className="mt-2 text-sm font-medium text-[var(--lp-text-nav)]">{guides[0].subtitle}</p>
                <p className="mt-4 text-sm leading-7 text-[var(--lp-text-body)]">{guides[0].text}</p>
                <p className="mt-4 text-sm leading-7 text-[var(--lp-text-body)]">
                  From beginner-friendly routes to advanced MTB trails, you&apos;ll explore the best of Florida with a guide who knows every turn. If you&apos;re looking for an experience similar to top-rated Airbnb Experiences, this is it — personal, guided, and built around you.
                </p>
                <a
                  href="/booking"
                  data-track="cta_click"
                  data-location="guides"
                  onClick={() => { trackCtaClick('Book a ride', 'guides'); trackBookingStart('guides'); }}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--lp-green)] transition hover:text-[var(--lp-green-dark)]"
                >
                  Book a ride
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Testimonials"
            title="Rides people remember long after the trail ends"
            text="Friendly local guides, ride-ready bikes, and a pace that meets people where they are. First-time visitors and returning riders alike leave with an easier, more memorable Florida experience."
          />

          <div className="mt-6 inline-flex rounded-full border border-[var(--lp-border-soft)] bg-[var(--lp-card-light)] px-4 py-2 text-sm text-[var(--lp-text-body)]">
            Guided by local riders who know the trails, the route timing, and how to make new riders feel comfortable fast.
          </div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="mt-10 grid gap-6 lg:grid-cols-3"
          >
            {testimonials.map((item) => (
              <motion.figure
                key={`${item.name}-${item.location}`}
                variants={fadeUp}
                className="rounded-[2rem] border border-[var(--lp-border)] bg-[var(--lp-card-70)] p-7 shadow-[0_12px_40px_rgba(16,38,29,0.05)]"
              >
                <div className="flex items-center gap-1 text-[var(--lp-green)]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-5 text-base leading-7 text-[var(--lp-text-body)]">
                  "{item.quote}"
                </blockquote>
                <figcaption className="mt-6">
                  <p className="text-sm font-semibold text-[var(--lp-text)]">{item.name}</p>
                  <p className="text-sm text-[var(--lp-text-muted)]">{item.location}</p>
                </figcaption>
              </motion.figure>
            ))}
          </motion.div>
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
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="relative h-64 overflow-hidden rounded-[1.5rem] border border-[var(--lp-border-soft)] bg-[var(--lp-card-light)]">
                    <Image
                      src="/images/bikes/bike-stumpjumper.png"
                      alt="Specialized Stumpjumper mountain bike prepared for guided trail rentals"
                      fill
                      sizes="(min-width: 1024px) 24vw, 100vw"
                      className="object-contain p-4"
                    />
                  </div>
                  <div className="relative h-64 overflow-hidden rounded-[1.5rem] border border-[var(--lp-border-soft)] bg-[var(--lp-card-light)]">
                    <Image
                      src="/images/bikes/bike-ebike.png"
                      alt="Premium electric bike available for guided Florida trail rides"
                      fill
                      sizes="(min-width: 1024px) 24vw, 100vw"
                      className="object-contain p-4"
                    />
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--lp-border-soft)] bg-[var(--lp-card-light)] p-6">
                  <div className="grid items-center gap-6 md:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.22em] text-[var(--lp-text-muted)]">Bike shop</p>
                      <h3 className="mt-2 text-xl font-bold text-[var(--lp-text)]">Bicikleta, Sanford FL</h3>
                      <p className="mt-3 text-sm leading-6 text-[var(--lp-text-body)]">
                        A local shop experience that supports riders who want premium bike rentals without the extra hassle.
                      </p>
                    </div>
                    <div className="flex justify-center md:justify-end">
                      <div className="relative h-28 w-28 overflow-hidden rounded-full border border-[var(--lp-border-soft)] bg-[var(--lp-surface)] p-2 sm:h-32 sm:w-32">
                      <Image
                        src="/images/branding/logo-primary.png"
                        alt="Florida Mountain Bike Guides badge logo"
                        fill
                        sizes="128px"
                        className="object-contain"
                      />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="border-y border-[var(--lp-border)] bg-[var(--lp-bg-alt)]">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="What To Expect"
              title="A smooth, reassuring flow from arrival to finish"
              text="Everything is designed to feel easy for first-time visitors. You show up, meet your guide, get comfortably fitted, and enjoy the ride at a pace that works for you."
            />

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              variants={stagger}
              className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-5"
            >
              {whatToExpect.map((item) => (
                <motion.div
                  key={item.step}
                  variants={fadeUp}
                  className="rounded-[1.9rem] border border-[var(--lp-border)] bg-[var(--lp-card)] p-6 shadow-[0_12px_40px_rgba(16,38,29,0.04)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--lp-badge-text)]">{item.step}</p>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--lp-text)]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--lp-text-body)]">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="FAQ"
            title="Questions riders usually ask before booking"
            text="Clear answers for first-time guests, families, and travelers planning a guided ride in Central Florida."
          />

          <div className="mt-12 space-y-4">
            {faqItems.map((item) => (
              <details
                key={item.q}
                className="group rounded-[1.6rem] border border-[var(--lp-border)] bg-[var(--lp-card-70)] px-6 py-5 shadow-[0_10px_30px_rgba(16,38,29,0.04)]"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left">
                  <span className="text-base font-semibold text-[var(--lp-text)]">{item.q}</span>
                  <span className="mt-0.5 shrink-0 rounded-full border border-[var(--lp-border-soft)] bg-[var(--lp-card-light)] px-2 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--lp-badge-text)] transition group-open:bg-[var(--lp-tan)]">
                    Open
                  </span>
                </summary>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--lp-text-body)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7 }}
            className="relative overflow-hidden rounded-[2.25rem] border border-[#d5c4a8] bg-[linear-gradient(135deg,rgba(31,90,67,0.95),rgba(39,92,70,0.88),rgba(194,165,120,0.78))] p-8 shadow-[0_22px_70px_rgba(16,38,29,0.12)] sm:p-10"
          >
            <Image
              src="/images/booking/booking-bg.png"
              alt="Guided group ride inviting visitors to book a Florida trail experience"
              fill
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,38,29,0.88),rgba(16,38,29,0.62),rgba(16,38,29,0.44))]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,29,0.12),rgba(16,38,29,0.3))]" />
            <div className="relative z-10 max-w-4xl">
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
                <a
                  href="/booking"
                  data-track="cta_click"
                  data-location="cta_banner"
                  onClick={() => { trackCtaClick('Book a Tour', 'cta_banner'); trackBookingStart('cta_banner'); }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f7efdf] px-5 py-3 text-sm font-semibold text-[var(--lp-green-dark)] transition hover:-translate-y-0.5 hover:bg-[var(--lp-card-solid)]"
                >
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
                    data-track="contact_form_submit"
                    onClick={() => trackContactFormSubmit()}
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

