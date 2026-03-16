'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useState, useEffect, useRef } from 'react';
import { MapPin, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const DIFFICULTY = {
  'First Time': { color: '#10b981', badge: 'bg-emerald-100 text-emerald-800' },
  'Beginner':   { color: '#1f7a54', badge: 'bg-teal-100 text-teal-800'     },
  'Intermediate': { color: '#d97706', badge: 'bg-amber-100 text-amber-800' },
  'Advanced':   { color: '#dc2626', badge: 'bg-red-100 text-red-800'       },
};

const LOCATIONS = [
  {
    id: 'lake-druid',
    name: 'Lake Druid Park',
    location: 'Orlando',
    difficulty: 'First Time',
    lat: 28.5467, lng: -81.3765,
    desc: 'Wide beginner-friendly trails perfect for learning the basics of mountain biking in a safe and open environment.',
    mapsUrl: 'https://maps.app.goo.gl/WjApuDjQubbBJJBQ6',
  },
  {
    id: 'soldiers-creek-ft',
    name: 'Soldiers Creek Park',
    location: 'Longwood',
    difficulty: 'First Time',
    lat: 28.6978, lng: -81.3427,
    desc: 'Smooth and easy trails ideal for practicing balance, braking, and turning while building confidence on dirt.',
    mapsUrl: 'https://maps.app.goo.gl/Xq7WKPN9pFJuGZGw8',
  },
  {
    id: 'markham-woods',
    name: 'Markham Woods Trail',
    location: 'Lake Mary',
    difficulty: 'Beginner',
    lat: 28.7586, lng: -81.3179,
    desc: 'Flowing forest trails with light roots and gentle turns, perfect for riders ready to improve control and bike handling.',
    mapsUrl: 'https://maps.app.goo.gl/u7hqJcQw9RGL16PaA',
  },
  {
    id: 'little-big-econ',
    name: 'Little Big Econ Jones East',
    location: 'Chuluota',
    difficulty: 'Beginner',
    lat: 28.6197, lng: -81.0947,
    desc: 'A scenic trail through pine forest with smooth sections and gentle climbs, great for riders stepping up from beginner level.',
    mapsUrl: 'https://maps.app.goo.gl/KiEEaaJXGJbDHo7r7',
  },
  {
    id: 'soldiers-creek-b',
    name: 'Soldiers Creek Park',
    location: 'Longwood',
    difficulty: 'Beginner',
    lat: 28.6990, lng: -81.3440,
    desc: 'Fun and approachable trails with mild technical features, ideal for improving skills while keeping the ride enjoyable.',
    mapsUrl: 'https://maps.app.goo.gl/Xq7WKPN9pFJuGZGw8',
  },
  {
    id: 'mount-dora',
    name: 'Mount Dora Mountain Bike Trail',
    location: 'Mount Dora',
    difficulty: 'Intermediate',
    lat: 28.8015, lng: -81.6448,
    desc: 'Technical trail system with climbs, descents, and optional jumps designed for riders ready for a bigger challenge.',
    mapsUrl: 'https://maps.app.goo.gl/FQtUAx8ZS2zwpQpZ7',
  },
  {
    id: 'chuck-lennon',
    name: 'Chuck Lennon MTB Trailhead',
    location: 'Deleon Springs',
    difficulty: 'Intermediate',
    lat: 29.1304, lng: -81.3583,
    desc: 'Flowing singletrack with roots, climbs, and fast sections that challenge riders while rewarding strong control.',
    mapsUrl: 'https://maps.app.goo.gl/Q9oC3jfyLHGtddkZ8',
  },
  {
    id: 'river-bend',
    name: 'River Bend',
    location: 'Ormond Beach',
    difficulty: 'Intermediate',
    lat: 29.2852, lng: -81.0573,
    desc: 'A scenic trail with tight tree lines, roots, and flowing terrain that tests balance and bike handling skills.',
    mapsUrl: 'https://maps.app.goo.gl/m9wLtSRAV9dNCuhR6',
  },
  {
    id: 'doris-leeper',
    name: 'Doris Leeper Spruce Creek MTB',
    location: 'Port Orange',
    difficulty: 'Intermediate',
    lat: 29.1280, lng: -80.9967,
    desc: 'Fast and technical trails with roots and flowing sections, ideal for riders looking to sharpen their technique.',
    mapsUrl: 'https://maps.app.goo.gl/F1qUgb47Yj5K4MZn7',
  },
  {
    id: 'santos',
    name: 'Santos Trailhead',
    location: 'Ocala',
    difficulty: 'Advanced',
    lat: 29.1485, lng: -82.1234,
    desc: 'World-class mountain bike destination featuring jumps, drops, and technical terrain for expert riders.',
    mapsUrl: 'https://maps.app.goo.gl/YVVXwnwXZiTaJ4tT6',
  },
  {
    id: 'graham-swamp',
    name: 'Graham Swamp East Trailhead MTB',
    location: 'Palm Coast',
    difficulty: 'Advanced',
    lat: 29.5785, lng: -81.2165,
    desc: 'Challenging trail with steep climbs, fast descents, and rugged terrain designed for highly skilled riders.',
    mapsUrl: 'https://maps.app.goo.gl/3cZ8NEZ4eJFjD8bo6',
  },
];

// ---------------------------------------------------------------------------
// Leaflet styles
// ---------------------------------------------------------------------------

function injectMapStyles() {
  if (typeof document === 'undefined' || document.getElementById('itm-css')) return;
  const el = document.createElement('style');
  el.id = 'itm-css';
  el.textContent = `
    @keyframes itmPing {
      0%        { transform: scale(1);   opacity: 0.65; }
      70%, 100% { transform: scale(3.2); opacity: 0;    }
    }
    .itm-ping { animation: itmPing 2.4s cubic-bezier(0, 0, 0.2, 1) infinite; }
    .leaflet-popup-content-wrapper {
      padding: 0 !important; border-radius: 16px !important;
      border: 1px solid #ddd2be !important;
      box-shadow: 0 16px 50px rgba(16,38,29,0.15) !important;
      overflow: hidden !important;
    }
    .leaflet-popup-content { margin: 0 !important; width: auto !important; }
    .leaflet-popup-tip-container { display: none !important; }
    .leaflet-popup-close-button { top: 10px !important; right: 10px !important; color: #9ca3af !important; font-size: 18px !important; }
    .leaflet-control-zoom { border-radius: 12px !important; overflow: hidden; border: 1px solid #ddd2be !important; box-shadow: 0 4px 12px rgba(16,38,29,0.08) !important; }
    .leaflet-control-zoom a { color: #1f5a43 !important; background: #f8f3ea !important; border-bottom-color: #ddd2be !important; }
    .leaflet-control-zoom a:hover { background: white !important; }
    .leaflet-control-attribution { background: rgba(246,241,231,0.9) !important; color: #8a947f !important; font-size: 10px !important; border-radius: 8px 0 0 0 !important; }
  `;
  document.head.appendChild(el);
}

// ---------------------------------------------------------------------------
// Pin icon
// ---------------------------------------------------------------------------

function createPinIcon(color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:44px;height:44px;">
        <div class="itm-ping" style="position:absolute;inset:0;border-radius:50%;background:${color};pointer-events:none;"></div>
        <div style="position:absolute;inset:8px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 14px ${color}55;border:2.5px solid rgba(255,255,255,0.92);">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -52],
  });
}

// ---------------------------------------------------------------------------
// Trail card carousel
// ---------------------------------------------------------------------------

function TrailCarousel() {
  const trackRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  function updateState() {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
    const cardWidth = el.scrollWidth / LOCATIONS.length;
    setActiveIndex(Math.round(el.scrollLeft / cardWidth));
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateState();
    el.addEventListener('scroll', updateState, { passive: true });
    return () => el.removeEventListener('scroll', updateState);
  }, []);

  function scrollBy(dir) {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / LOCATIONS.length;
    el.scrollBy({ left: dir * cardWidth, behavior: 'smooth' });
  }

  function scrollTo(index) {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / LOCATIONS.length;
    el.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  }

  return (
    <div className="relative mt-6">
      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto pb-2"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {LOCATIONS.map((loc) => {
          const diff = DIFFICULTY[loc.difficulty];
          return (
            <div
              key={loc.id}
              className="shrink-0 rounded-[1.5rem] border border-[var(--lp-border)] bg-[var(--lp-card)] p-5 shadow-[0_8px_28px_rgba(16,38,29,0.05)]"
              style={{ scrollSnapAlign: 'start', width: 'clamp(260px, 68vw, 320px)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="rounded-xl p-2 shrink-0"
                  style={{ background: `${diff.color}20`, color: diff.color }}
                >
                  <MapPin className="h-4 w-4" />
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${diff.badge}`}>
                  {loc.difficulty}
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-[14px] font-semibold leading-tight text-[var(--lp-text)]">{loc.name}</h3>
                <p className="mt-0.5 text-xs text-[var(--lp-text-nav)]">{loc.location}</p>
              </div>
              <p className="mt-2.5 text-xs leading-5 text-[var(--lp-text-body)]">{loc.desc}</p>
              <a
                href={loc.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--lp-green)] transition hover:text-[var(--lp-green-dark)]"
              >
                Open in Maps
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          );
        })}
      </div>

      {/* Arrows */}
      {canLeft && (
        <button
          onClick={() => scrollBy(-1)}
          className="absolute -left-4 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--lp-border)] bg-[var(--lp-card-solid)] shadow text-[var(--lp-text)] transition hover:bg-[var(--lp-tan)]"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canRight && (
        <button
          onClick={() => scrollBy(1)}
          className="absolute -right-4 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--lp-border)] bg-[var(--lp-card-solid)] shadow text-[var(--lp-text)] transition hover:bg-[var(--lp-tan)]"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Dots */}
      <div className="mt-4 flex justify-center gap-1.5">
        {LOCATIONS.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIndex ? 'w-5 bg-[var(--lp-green)]' : 'w-1.5 bg-[var(--lp-border)]'
            }`}
            aria-label={`Go to trail ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InteractiveTrailMap() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    injectMapStyles();
    setMounted(true);
  }, []);

  return (
    <div className="w-full space-y-8">

      {/* Map */}
      <div
        className="relative overflow-hidden rounded-[2rem] border border-[var(--lp-border)] shadow-[0_20px_70px_rgba(16,38,29,0.08)]"
        style={{ height: 'clamp(360px, 55vh, 480px)' }}
      >
        {mounted ? (
          <MapContainer
            center={[29.0, -81.5]}
            zoom={8}
            style={{ height: '100%', width: '100%', background: '#f8f3ea' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              maxZoom={19}
            />
            {LOCATIONS.map((loc) => (
              <Marker
                key={loc.id}
                position={[loc.lat, loc.lng]}
                icon={createPinIcon(DIFFICULTY[loc.difficulty].color)}
              >
                <Popup minWidth={224}>
                  <div className="w-56 bg-[#f6f1e7] p-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${DIFFICULTY[loc.difficulty].badge}`}>
                      {loc.difficulty}
                    </span>
                    <h3 className="mt-2 text-sm font-bold leading-snug text-[#10261d]">{loc.name}</h3>
                    <p className="mt-0.5 text-xs text-[#6a7b73]">{loc.location}</p>
                    <p className="mt-2 text-xs leading-5 text-[#5b6b64]">{loc.desc}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <a
                        href={loc.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-[#1f5a43] transition hover:text-[#153a2c]"
                      >
                        Open in Maps
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href="/booking"
                        className="flex items-center gap-1 text-xs font-semibold text-[#1f5a43] transition hover:text-[#153a2c]"
                      >
                        Book Tour →
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div className="flex h-full items-center justify-center bg-[#f8f3ea]">
            <div className="text-center">
              <MapPin className="mx-auto mb-3 h-8 w-8 animate-pulse text-[#1f5a43]" />
              <p className="text-sm text-[#5b6b64]">Loading map…</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(DIFFICULTY).map(([label, { color, badge }]) => (
          <span key={label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badge}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {/* Trail cards carousel */}
      <TrailCarousel />

    </div>
  );
}
