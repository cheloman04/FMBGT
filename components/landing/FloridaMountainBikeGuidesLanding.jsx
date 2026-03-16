'use client';

import React from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

// Leaflet requires browser APIs — must be loaded with ssr:false
const InteractiveTrailMap = dynamic(
  () => import('@/components/map/InteractiveTrailMap'),
  { ssr: false, loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-[2rem] border border-[#d8ccba] bg-[#f8f3ea]">
      <p className="text-sm text-[#5b6b64]">Loading map…</p>
    </div>
  )}
);
import {
  ArrowRight,
  Bike,
  Calendar,
  Camera,
  ChevronRight,
  Clock3,
  Mail,
  MapPin,
  Mountain,
  Phone,
  Route,
  ShieldCheck,
  Star,
  Trees,
  Users,
  Waves,
} from "lucide-react";
import { CTAButton } from "@/components/ui/CTAButton";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatCard } from "@/components/ui/StatCard";

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
    text: "Short on time or can’t get the car? Pickup and drop-off can be arranged for added convenience.",
    icon: Route,
  },
];

const tours = [
  {
    title: "Mountain Bike Tours",
    badge: "Signature Experience",
    description:
      "Guided mountain bike tours designed for riders of every skill level, focused on making Florida’s best trails easy, fun, and unforgettable.",
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


export default function FloridaMountainBikeGuidesLanding() {
  return (
    <div className="min-h-screen bg-[#f6f1e7] text-[#10261d]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-[24rem] h-[22rem] w-[22rem] rounded-full bg-[#d7c3a1]/35 blur-3xl" />
        <div className="absolute left-[-8rem] top-[58rem] h-[20rem] w-[20rem] rounded-full bg-cyan-200/30 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-[#d8cdb8] bg-[#f6f1e7]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e4dccb] ring-1 ring-[#cfc1aa]">
              <Bike className="h-5 w-5 text-[#1f5a43]" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1f5a43]">
                Florida Mountain Bike Guides
              </p>
              <p className="text-xs text-[#6a7b73]">Mountain biking in the land of no mountains</p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-[#56665f] md:flex">
            <a href="#tours" className="transition hover:text-[#10261d]">Tours</a>
            <a href="#map" className="transition hover:text-[#10261d]">Map</a>
            <a href="#guides" className="transition hover:text-[#10261d]">Guides</a>
            <a href="#fleet" className="transition hover:text-[#10261d]">Fleet</a>
            <a href="#contact" className="transition hover:text-[#10261d]">Contact</a>
          </nav>

          <div className="hidden md:block">
            <CTAButton>Book a Guide</CTAButton>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 sm:pb-24 lg:px-8 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-3xl">
              <motion.div variants={fadeUp} className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d7c5a9] bg-[#efe4ce] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#7b5a2e]">
                <Star className="h-3.5 w-3.5" />
                Where Adventure Meets Simplicity
              </motion.div>

              <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1f5a43]">
                Welcome to Florida Mountain Bike Guides
              </motion.p>

              <motion.h1 variants={fadeUp} className="mt-4 text-4xl font-black leading-tight tracking-tight text-[#10261d] sm:text-5xl lg:text-7xl">
                Mountain biking in the <span className="text-[#1f5a43]">land of no mountains</span>
              </motion.h1>

              <motion.p variants={fadeUp} className="mt-6 max-w-2xl text-lg leading-8 text-[#4d5d56] sm:text-xl">
                Guided mountain bike tours and scenic paved trail rides across Central Florida — with quality bikes, essential gear, and friendly local guides waiting right at the trailhead.
              </motion.p>

              <motion.p variants={fadeUp} className="mt-4 max-w-2xl text-base leading-7 text-[#5b6b64]">
                Just choose your location and date, show up ready to ride, and let the adventure begin. For riders who need a little extra convenience, pickup and drop-off can also be arranged.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-4 sm:flex-row">
                <CTAButton>Book a Guide</CTAButton>
                <CTAButton secondary>Explore Trails</CTAButton>
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
              className="relative"
            >
              <div className="relative overflow-hidden rounded-[2rem] border border-[#d7cdb9] bg-[linear-gradient(135deg,rgba(31,90,67,0.16),rgba(215,195,161,0.22),rgba(255,255,255,0.55))] p-4 shadow-[0_25px_80px_rgba(16,38,29,0.12)]">
                <div className="aspect-[4/5] rounded-[1.5rem] border border-white/60 bg-[radial-gradient(circle_at_top,_rgba(31,90,67,0.18),_transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.75),rgba(255,255,255,0.45))] p-5">
                  <div className="flex h-full flex-col justify-between rounded-[1.25rem] border border-white/50 bg-[#f7f1e5]/85 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-[#7a847f]">Featured Experience</p>
                        <h3 className="mt-2 text-2xl font-bold text-[#10261d]">Central Florida Trail Adventures</h3>
                      </div>
                      <div className="rounded-2xl bg-[#e5d8bf] p-3">
                        <Trees className="h-6 w-6 text-[#1f5a43]" />
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className="rounded-3xl border border-white/60 bg-white/70 p-4">
                        <div className="flex items-center gap-3 text-sm text-[#42514a]">
                          <Clock3 className="h-4 w-4 text-[#1f5a43]" />
                          Easy to book, easy to show up for, unforgettable to ride.
                        </div>
                      </div>
                      <div className="rounded-3xl border border-white/60 bg-white/70 p-4">
                        <div className="flex items-center gap-3 text-sm text-[#42514a]">
                          <MapPin className="h-4 w-4 text-[#1f5a43]" />
                          Sanford, Blue Spring, riverfront routes, and trail access points.
                        </div>
                      </div>
                      <div className="rounded-3xl border border-white/60 bg-white/70 p-4">
                        <div className="flex items-center gap-3 text-sm text-[#42514a]">
                          <Users className="h-4 w-4 text-[#1f5a43]" />
                          Friendly guides who make the ride smoother, safer, and more fun.
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-3xl border border-white/60 bg-white/70 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#7a847f]">Tour styles</p>
                        <p className="mt-2 text-3xl font-black text-[#10261d]">2</p>
                      </div>
                      <div className="rounded-3xl border border-white/60 bg-white/70 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#7a847f]">Vibe</p>
                        <p className="mt-2 text-3xl font-black text-[#10261d]">Florida</p>
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
                  className="rounded-[1.75rem] border border-[#ddd2be] bg-white/70 p-6 backdrop-blur-sm shadow-[0_10px_40px_rgba(16,38,29,0.05)] transition hover:-translate-y-1 hover:bg-white"
                >
                  <div className="mb-4 inline-flex rounded-2xl bg-[#e8dcc6] p-3 text-[#1f5a43] ring-1 ring-[#d8c7ad]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#10261d]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5b6b64]">{item.text}</p>
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
                  className="group relative overflow-hidden rounded-[2rem] border border-[#ddd2be] bg-white/75 p-8 backdrop-blur-sm shadow-[0_15px_50px_rgba(16,38,29,0.06)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-[#d9c6a6]/10 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-4">
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#efe4cf] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#7b5a2e]">
                        {tour.badge}
                      </div>
                      <div className="rounded-2xl bg-[#e8dcc6] p-3 ring-1 ring-[#d8c7ad]">
                        <Icon className="h-6 w-6 text-[#1f5a43]" />
                      </div>
                    </div>
                    <h3 className="mt-6 text-2xl font-bold text-[#10261d] sm:text-3xl">{tour.title}</h3>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-[#51615a]">{tour.description}</p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {tour.points.map((point) => (
                        <div key={point} className="rounded-2xl border border-[#e2d7c6] bg-[#faf7f1] px-4 py-3 text-sm text-[#34423d]">
                          {point}
                        </div>
                      ))}
                    </div>

                    <a href="#contact" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#1f5a43] transition hover:text-[#153a2c]">
                      {tour.cta}
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        <section id="map" className="border-y border-[#ddd2be] bg-[#efe8da]">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Interactive Map"
              title="A map-led section designed for discovery, booking, and local context"
              text="This section is intentionally built to be replaced by a real interactive map Claude Code can generate later. For now, it sells the idea while keeping the design premium and conversion-friendly."
            />

            <div className="mt-12">
              <InteractiveTrailMap />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Trails"
            title="Central Florida trails presented like a premium outdoor experience"
            text="Instead of a plain info block, this section frames the trail offering with the kind of clarity and aspiration you’d expect from Patagonia, AllTrails, or a modern outdoor travel brand."
          />

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="mt-12 grid gap-6 lg:grid-cols-3"
          >
            {trailHighlights.map((item) => (
              <motion.div key={item.title} variants={fadeUp} className="rounded-[2rem] border border-[#ddd2be] bg-white/70 p-7 shadow-[0_12px_40px_rgba(16,38,29,0.04)]">
                <h3 className="text-xl font-bold text-[#10261d]">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[#586861]">{item.text}</p>
                <a href="#map" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#1f5a43]">
                  Explore trails
                  <ChevronRight className="h-4 w-4" />
                </a>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section id="guides" className="border-y border-[#ddd2be] bg-[#f1ebdf]">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Guides"
              title="A team of friendly and professional experts"
              text="The guide section highlights trust, local knowledge, and a safe enjoyable ride — exactly what matters when someone is booking an outdoor experience in a place they may not know well."
            />

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
              className="mt-12 grid gap-6 lg:grid-cols-3"
            >
              {guides.map((guide) => (
                <motion.div key={guide.title} variants={fadeUp} className="overflow-hidden rounded-[2rem] border border-[#ddd2be] bg-white/75 shadow-[0_12px_40px_rgba(16,38,29,0.04)]">
                  <div className="h-56 bg-[linear-gradient(135deg,rgba(31,90,67,0.18),rgba(215,195,161,0.22),rgba(117,196,210,0.12))]" />
                  <div className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7b5a2e]">Guide Profile</p>
                    <h3 className="mt-3 text-2xl font-bold text-[#10261d]">{guide.title}</h3>
                    <p className="mt-2 text-sm font-medium text-[#62726c]">{guide.subtitle}</p>
                    <p className="mt-4 text-sm leading-7 text-[#4f5f58]">{guide.text}</p>
                  </div>
                </motion.div>
              ))}
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
                text="No guide needed? Bicikleta Bike Shop in Sanford offers full-suspension Specialized Stumpjumpers for rent, combining top-notch hospitality with the charm of a local bike shop."
              />
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {fleetFeatures.map((item) => (
                  <div key={item} className="rounded-2xl border border-[#e2d7c6] bg-white/70 px-4 py-4 text-sm text-[#34423d] shadow-[0_8px_25px_rgba(16,38,29,0.03)]">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <CTAButton>Check Out our Rental Fleet</CTAButton>
                <CTAButton secondary>Bicikleta Bike Rentals</CTAButton>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7 }}
              className="rounded-[2rem] border border-[#ddd2be] bg-white/70 p-5 shadow-[0_18px_60px_rgba(16,38,29,0.06)]"
            >
              <div className="rounded-[1.5rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.85),rgba(247,241,231,0.92))] p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-[#e5dac8] bg-[#faf7f1] p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#7c847f]">Bike shop</p>
                    <h3 className="mt-2 text-xl font-bold text-[#10261d]">Bicikleta, Sanford FL</h3>
                    <p className="mt-3 text-sm leading-6 text-[#4f5f58]">
                      A local shop experience that supports riders who want premium bike rentals without the extra hassle.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[#e5dac8] bg-[#faf7f1] p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#7c847f]">Rental focus</p>
                    <h3 className="mt-2 text-xl font-bold text-[#10261d]">Ride-ready setup</h3>
                    <p className="mt-3 text-sm leading-6 text-[#4f5f58]">
                      Specialized Stumpjumpers and electric bike options positioned as part of an effortless Florida ride experience.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[#e5dac8] bg-[#faf7f1] p-5 sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#7c847f]">Why this matters</p>
                    <p className="mt-3 text-sm leading-7 text-[#4f5f58]">
                      The new landing supports both customer paths: visitors looking for a fully guided experience and riders who simply want to rent a high-quality bike.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="border-y border-[#ddd2be] bg-[#efe8da]">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Photo Gallery"
              title="A visual section designed to feel active, warm, and modern"
              text="Replace these placeholders with real client photography. The layout already supports a premium gallery vibe similar to a modern outdoor travel brand."
            />

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
              className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
            >
              {galleryItems.map((item, index) => (
                <motion.div key={item.title} variants={fadeUp} className="group overflow-hidden rounded-[1.75rem] border border-[#ddd2be] bg-white/75 shadow-[0_12px_40px_rgba(16,38,29,0.04)]">
                  <div className="relative h-64 overflow-hidden bg-[linear-gradient(135deg,rgba(31,90,67,0.18),rgba(215,195,161,0.28),rgba(117,196,210,0.14))]">
                    <div className="absolute inset-0 transition duration-500 group-hover:scale-110 group-hover:rotate-1">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.22),transparent_22%),linear-gradient(180deg,transparent,rgba(16,38,29,0.24))]" />
                    </div>
                    <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/60 px-3 py-1 text-xs font-medium text-[#2c3a35] backdrop-blur-md">
                      <Camera className="h-3.5 w-3.5" />
                      {item.category}
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-xl font-bold text-white">{item.title}</h3>
                      <p className="mt-1 text-sm text-white/85">Image slot {index + 1}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
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
                Choose your trail, meet your guide, and experience Central Florida with less hassle and more adventure.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
                From scenic paved rides to guided mountain bike tours, the redesigned page is built to make booking feel easy while still showcasing the premium outdoor vibe of the brand.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a href="#contact" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f7efdf] px-5 py-3 text-sm font-semibold text-[#173a2c] transition hover:-translate-y-0.5 hover:bg-white">
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

        <section id="contact" className="border-t border-[#ddd2be] bg-[#f7f2e8]">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <SectionHeading
                  eyebrow="Get In Touch"
                  title="Contact and social, kept simple and welcoming"
                  text="Keep the adventure going by staying connected. This section is designed to support questions, lead capture, and later integrations with real booking or CRM flows."
                />

                <div className="mt-8 grid gap-4">
                  <div className="rounded-3xl border border-[#e2d7c6] bg-white/75 p-5 shadow-[0_8px_25px_rgba(16,38,29,0.03)]">
                    <div className="flex items-center gap-3 text-[#3c4b45]">
                      <Mail className="h-5 w-5 text-[#1f5a43]" />
                      <span>Email inquiries</span>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-[#e2d7c6] bg-white/75 p-5 shadow-[0_8px_25px_rgba(16,38,29,0.03)]">
                    <div className="flex items-center gap-3 text-[#3c4b45]">
                      <Phone className="h-5 w-5 text-[#1f5a43]" />
                      <span>Tour questions & logistics</span>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-[#e2d7c6] bg-white/75 p-5 shadow-[0_8px_25px_rgba(16,38,29,0.03)]">
                    <div className="flex items-center gap-3 text-[#3c4b45]">
                      <MapPin className="h-5 w-5 text-[#1f5a43]" />
                      <span>Based out of Sanford, Florida</span>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-[#e2d7c6] bg-white/75 p-5 shadow-[0_8px_25px_rgba(16,38,29,0.03)]">
                    <div className="flex items-center gap-3 text-[#3c4b45]">
                      <Compass className="h-5 w-5 text-[#1f5a43]" />
                      <span>Sanford Tours & Experiences</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-[#ddd2be] bg-white/80 p-6 shadow-[0_16px_50px_rgba(16,38,29,0.05)] sm:p-8">
                <form className="grid gap-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#44544d]">Name</label>
                      <input
                        type="text"
                        placeholder="Your name"
                        className="w-full rounded-2xl border border-[#dfd4c2] bg-[#fbf8f2] px-4 py-3 text-[#10261d] outline-none placeholder:text-[#8a948f] focus:border-[#1f5a43]/40"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#44544d]">Email</label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        className="w-full rounded-2xl border border-[#dfd4c2] bg-[#fbf8f2] px-4 py-3 text-[#10261d] outline-none placeholder:text-[#8a948f] focus:border-[#1f5a43]/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#44544d]">Phone Number (optional)</label>
                    <input
                      type="text"
                      placeholder="(555) 555-5555"
                      className="w-full rounded-2xl border border-[#dfd4c2] bg-[#fbf8f2] px-4 py-3 text-[#10261d] outline-none placeholder:text-[#8a948f] focus:border-[#1f5a43]/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#44544d]">Questions?</label>
                    <textarea
                      rows={5}
                      placeholder="Tell us about your ideal ride, your skill level, or the type of tour you’re looking for."
                      className="w-full rounded-2xl border border-[#dfd4c2] bg-[#fbf8f2] px-4 py-3 text-[#10261d] outline-none placeholder:text-[#8a948f] focus:border-[#1f5a43]/40"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1f5a43] px-5 py-3 text-sm font-semibold text-[#f8f3e8] transition hover:-translate-y-0.5 hover:bg-[#174b37]"
                    >
                      Submit
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section id="claude-prompt" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-[#ddd2be] bg-white/80 p-6 shadow-[0_16px_50px_rgba(16,38,29,0.05)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7b5a2e]">Claude Code Prompt</p>
            <h2 className="mt-3 text-2xl font-bold text-[#10261d] sm:text-3xl">Interactive map component prompt</h2>
            <pre className="mt-6 overflow-x-auto rounded-[1.5rem] border border-[#e2d7c6] bg-[#faf7f1] p-5 text-sm leading-7 text-[#2d3d37]">
{`Create a React component called InteractiveTrailMap for a mountain bike tour website.

Requirements:
- Use React + React Leaflet.
- The map must display Central Florida.
- Add location pins for: Sanford Riverwalk, Blue Spring State Park, Bearford Lake, Central Florida trail network, and Bicikleta Bike Shop.
- Each pin should open a popup containing: trail name, short description, difficulty level, and a button labeled "Book Tour".
- Add a subtle pulsing animation effect to the markers.
- The map must be fully responsive.
- On mobile, collapse the map into a card list view with a toggle back to the map.
- On desktop, show the full interactive map.
- Style it with Tailwind CSS to match a premium outdoor brand with Patagonia + AllTrails energy and warm Florida sandy-green tones.
- Export the component so it can be imported into a Next.js page.
- Keep the code clean, modular, and production-friendly.`}
            </pre>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#ddd2be] bg-[#efe8da]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-[#6a7b73] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© Florida Mountain Bike Guides LLC — Redesign concept landing page.</p>
          <div className="flex flex-wrap gap-5">
            <a href="#tours" className="transition hover:text-[#10261d]">Mountain bike tours</a>
            <a href="#guides" className="transition hover:text-[#10261d]">Meet Our Guides</a>
            <a href="#fleet" className="transition hover:text-[#10261d]">Rental Fleet</a>
            <a href="#contact" className="transition hover:text-[#10261d]">Book a Tour</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
