'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useState, useEffect } from 'react';
import { MapPin, ChevronRight, Map, List } from 'lucide-react';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const LOCATIONS = [
  {
    id: 'sanford-riverwalk',
    name: 'Sanford Riverwalk',
    type: 'Paved Tour',
    difficulty: 'Easy',
    difficultyClass: 'bg-emerald-100 text-emerald-800',
    lat: 28.8014,
    lng: -81.2719,
    desc: 'Historic downtown Sanford, waterfront views, and a relaxed city-to-nature ride.',
    pinColor: '#1f5a43',
  },
  {
    id: 'blue-spring',
    name: 'Blue Spring State Park',
    type: 'Nature Tour',
    difficulty: 'Easy–Moderate',
    difficultyClass: 'bg-amber-100 text-amber-800',
    lat: 28.9408,
    lng: -81.3381,
    desc: "Crystal-clear spring water, seasonal manatees, and one of Central Florida's most iconic stops.",
    pinColor: '#0369a1',
  },
  {
    id: 'bearford-lake',
    name: 'Bearford Lake',
    type: 'Scenic Ride',
    difficulty: 'Easy',
    difficultyClass: 'bg-emerald-100 text-emerald-800',
    lat: 28.8700,
    lng: -81.2100,
    desc: 'A scenic stop that connects the Florida outdoor vibe with a relaxed two-wheel experience.',
    pinColor: '#1f5a43',
  },
  {
    id: 'cf-trail-network',
    name: 'Central Florida Trail Network',
    type: 'MTB Trails',
    difficulty: 'Moderate–Advanced',
    difficultyClass: 'bg-orange-100 text-orange-800',
    lat: 28.7200,
    lng: -81.5000,
    desc: "Guided off-road tours through Central Florida's premier singletrack trail system.",
    pinColor: '#b45309',
  },
  {
    id: 'bicikleta',
    name: 'Bicikleta Bike Shop',
    type: 'Rental Hub',
    difficulty: 'All Riders',
    difficultyClass: 'bg-violet-100 text-violet-800',
    lat: 28.8007,
    lng: -81.2691,
    desc: 'Sanford-based rental partner offering full-suspension Specialized Stumpjumpers and local hospitality.',
    pinColor: '#7c3aed',
  },
];

// ---------------------------------------------------------------------------
// Leaflet styles — injected once into document head
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
      padding: 0 !important;
      border-radius: 16px !important;
      border: 1px solid #ddd2be !important;
      box-shadow: 0 16px 50px rgba(16,38,29,0.15) !important;
      overflow: hidden !important;
    }
    .leaflet-popup-content { margin: 0 !important; width: auto !important; }
    .leaflet-popup-tip-container { display: none !important; }
    .leaflet-popup-close-button {
      top: 10px !important; right: 10px !important;
      color: #9ca3af !important; font-size: 18px !important;
    }
    .leaflet-control-zoom {
      border-radius: 12px !important;
      overflow: hidden;
      border: 1px solid #ddd2be !important;
      box-shadow: 0 4px 12px rgba(16,38,29,0.08) !important;
    }
    .leaflet-control-zoom a {
      color: #1f5a43 !important;
      background: #f8f3ea !important;
      border-bottom-color: #ddd2be !important;
    }
    .leaflet-control-zoom a:hover { background: white !important; }
    .leaflet-control-attribution {
      background: rgba(246,241,231,0.9) !important;
      color: #8a947f !important;
      font-size: 10px !important;
      border-radius: 8px 0 0 0 !important;
    }
  `;
  document.head.appendChild(el);
}

// ---------------------------------------------------------------------------
// Custom pulsing DivIcon
// ---------------------------------------------------------------------------

function createPinIcon(color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:44px;height:44px;">
        <div class="itm-ping" style="
          position:absolute;inset:0;border-radius:50%;
          background:${color};pointer-events:none;
        "></div>
        <div style="
          position:absolute;inset:8px;background:${color};border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 3px 14px ${color}55;
          border:2.5px solid rgba(255,255,255,0.92);
        ">
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
// Component
// ---------------------------------------------------------------------------

export default function InteractiveTrailMap() {
  const [mounted, setMounted] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'map'

  useEffect(() => {
    injectMapStyles();
    setMounted(true);
  }, []);

  return (
    <div className="w-full">

      {/* ── Mobile toggle ─────────────────────────────────────────────── */}
      <div className="mb-5 flex gap-2 sm:hidden">
        {[
          { id: 'list', Icon: List, label: 'Trail List' },
          { id: 'map',  Icon: Map,  label: 'Map View'  },
        ].map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setMobileView(id)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              mobileView === id
                ? 'border-[#1f5a43] bg-[#1f5a43] text-white'
                : 'border-[#ddd2be] bg-white/70 text-[#5b6b64] hover:border-[#1f5a43]/40'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Grid: map left, cards right ───────────────────────────────── */}
      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">

        {/* Map panel */}
        <div className={mobileView === 'list' ? 'hidden sm:block' : 'block'}>
          <div
            className="relative overflow-hidden rounded-[2rem] border border-[#d8ccba] shadow-[0_20px_70px_rgba(16,38,29,0.08)]"
            style={{ height: 'clamp(360px, 65vh, 520px)' }}
          >
            {mounted ? (
              <MapContainer
                center={[28.87, -81.33]}
                zoom={11}
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
                    icon={createPinIcon(loc.pinColor)}
                  >
                    <Popup minWidth={224}>
                      <div className="w-56 bg-[#f6f1e7] p-4">
                        <span className="inline-block rounded-full bg-[#efe4cf] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b5a2e]">
                          {loc.type}
                        </span>
                        <h3 className="mt-2 text-sm font-bold leading-snug text-[#10261d]">
                          {loc.name}
                        </h3>
                        <p className="mt-1.5 text-xs leading-5 text-[#5b6b64]">
                          {loc.desc}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${loc.difficultyClass}`}>
                            {loc.difficulty}
                          </span>
                          <a
                            href="/booking"
                            className="flex items-center gap-1 text-xs font-semibold text-[#1f5a43] transition hover:text-[#153a2c]"
                          >
                            Book Tour
                            <ChevronRight className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              /* Loading skeleton */
              <div className="flex h-full items-center justify-center bg-[#f8f3ea]">
                <div className="text-center">
                  <MapPin className="mx-auto mb-3 h-8 w-8 animate-pulse text-[#1f5a43]" />
                  <p className="text-sm text-[#5b6b64]">Loading map…</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card list */}
        <div className={`${mobileView === 'map' ? 'hidden sm:grid' : 'grid'} content-start gap-4`}>
          {LOCATIONS.map((loc) => (
            <div
              key={loc.id}
              className="rounded-[1.5rem] border border-[#ddd2be] bg-white/75 p-5 backdrop-blur-sm shadow-[0_10px_35px_rgba(16,38,29,0.04)] transition hover:border-[#cbb99c] hover:bg-white"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="rounded-2xl p-3"
                  style={{ background: `${loc.pinColor}1a`, color: loc.pinColor }}
                >
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold leading-tight text-[#10261d]">
                    {loc.name}
                  </h3>
                  <p className="text-sm text-[#62726c]">{loc.type}</p>
                </div>
                <span className="rounded-full border border-[#e2d7c6] bg-[#faf7f1] px-3 py-1 text-xs font-medium text-[#586861]">
                  {loc.difficulty}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#4d5d56]">{loc.desc}</p>
              <a
                href="/booking"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f5a43] transition hover:text-[#153a2c]"
              >
                Book Tour
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
