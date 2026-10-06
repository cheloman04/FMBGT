'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useState, useEffect } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { TRAILS } from '@/data/trails';
import { DIFFICULTY_STYLE, badgeLabel } from '@/components/map/difficulty';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

// CARTO basemaps now require a key: keyless requests get a 200 with an
// "API KEY REQUIRED" watermark tile instead of the map, so nothing errors.
// Without a key, fall back to OpenStreetMap's own tiles rather than shipping
// a map made of watermarks.
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_KEY;

const TILES = CARTO_KEY
  ? {
      url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }
  : {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };

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
              url={TILES.url}
              attribution={TILES.attribution}
              maxZoom={19}
            />
            {TRAILS.map((trail) => (
              <Marker
                key={trail.slug}
                position={[trail.lat, trail.lng]}
                icon={createPinIcon(DIFFICULTY_STYLE[trail.difficulty].color)}
              >
                <Popup minWidth={224}>
                  <div className="w-56 bg-[#f6f1e7] p-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${DIFFICULTY_STYLE[trail.difficulty].badge}`}>
                      {badgeLabel(trail)}
                    </span>
                    <h3 className="mt-2 text-sm font-bold leading-snug text-[#10261d]">{trail.name}</h3>
                    <p className="mt-0.5 text-xs text-[#6a7b73]">{trail.city}</p>
                    <p className="mt-2 text-xs leading-5 text-[#5b6b64]">{trail.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <a
                        href={trail.mapsUrl}
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
        {Object.entries(DIFFICULTY_STYLE).map(([label, { color, badge }]) => (
          <span key={label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badge}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

    </div>
  );
}
