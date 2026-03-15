'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useBooking } from '@/context/BookingContext';
import { getLocations } from '@/lib/supabase';
import type { Location } from '@/types/booking';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ─── Static content per location ─────────────────────────────────────────────

interface LocationMeta {
  image: string;
  description: string;
  mapLink: string;
}

const LOCATION_CONTENT: Record<string, LocationMeta> = {
  // Paved
  'Sanford Historic Riverfront Tour': {
    image: '/locations/sanford-historic-downtown.svg',
    description: "Explore Sanford's historic district and scenic riverfront on a relaxing ride through oak-lined streets, local shops, and vibrant downtown charm.",
    mapLink: 'https://maps.app.goo.gl/UQL4WTkzoXVSG4Ti8',
  },
  'Spring to Spring Trail Tour – Blue Spring State Park': {
    image: '/locations/blue-spring-state-park.svg',
    description: 'A scenic trail ride to Blue Spring State Park featuring clear springs, wildlife, and seasonal manatee sightings.',
    mapLink: 'https://maps.app.goo.gl/imgUh7LBef9cLj2d7',
  },
  // First Time MTB
  'Lake Druid Park, Orlando': {
    image: '/locations/location-placeholder.svg',
    description: 'Wide beginner-friendly trails perfect for learning the basics of mountain biking in a safe and open environment.',
    mapLink: 'https://maps.app.goo.gl/WjApuDjQubbBJJBQ6',
  },
  'Soldiers Creek Park, Longwood (First Time)': {
    image: '/locations/location-placeholder.svg',
    description: 'Smooth and easy trails ideal for practicing balance, braking, and turning while building confidence on dirt.',
    mapLink: 'https://maps.app.goo.gl/Xq7WKPN9pFJuGZGw8',
  },
  // Beginner MTB
  'Markham Woods Trail, Lake Mary': {
    image: '/locations/location-placeholder.svg',
    description: 'Flowing forest trails with light roots and gentle turns, perfect for riders ready to improve control and bike handling.',
    mapLink: 'https://maps.app.goo.gl/u7hqJcQw9RGL16PaA',
  },
  'Little Big Econ Jones East – Snow Hill Rd, Chuluota': {
    image: '/locations/location-placeholder.svg',
    description: 'A scenic trail through pine forest with smooth sections and gentle climbs, great for riders stepping up from beginner level.',
    mapLink: 'https://maps.app.goo.gl/KiEEaaJXGJbDHo7r7',
  },
  'Soldiers Creek Park, Longwood': {
    image: '/locations/location-placeholder.svg',
    description: 'Fun and approachable trails with mild technical features, ideal for improving skills while keeping the ride enjoyable.',
    mapLink: 'https://maps.app.goo.gl/Xq7WKPN9pFJuGZGw8',
  },
  // Intermediate MTB
  'Mount Dora Mountain Bike Trail, Mount Dora': {
    image: '/locations/location-placeholder.svg',
    description: 'Technical trail system with climbs, descents, and optional jumps designed for riders ready for a bigger challenge.',
    mapLink: 'https://maps.app.goo.gl/FQtUAx8ZS2zwpQpZ7',
  },
  'Chuck Lennon Mountain Bike Trailhead, DeLeon Springs': {
    image: '/locations/location-placeholder.svg',
    description: 'Flowing singletrack with roots, climbs, and fast sections that challenge riders while rewarding strong control.',
    mapLink: 'https://maps.app.goo.gl/Q9oC3jfyLHGtddkZ8',
  },
  'River Bend, Ormond Beach': {
    image: '/locations/location-placeholder.svg',
    description: 'A scenic trail with tight tree lines, roots, and flowing terrain that tests balance and bike handling skills.',
    mapLink: 'https://maps.app.goo.gl/m9wLtSRAV9dNCuhR6',
  },
  'Doris Leeper Spruce Creek MTB Trailhead, Port Orange': {
    image: '/locations/location-placeholder.svg',
    description: 'Fast and technical trails with roots and flowing sections, ideal for riders looking to sharpen their technique.',
    mapLink: 'https://maps.app.goo.gl/F1qUgb47Yj5K4MZn7',
  },
  // Advanced MTB
  'Santos Trailhead, Ocala': {
    image: '/locations/location-placeholder.svg',
    description: 'World-class mountain bike destination featuring jumps, drops, and technical terrain for expert riders.',
    mapLink: 'https://maps.app.goo.gl/YVVXwnwXZiTaJ4tT6',
  },
  'Graham Swamp East Trailhead MTB, Palm Coast': {
    image: '/locations/location-placeholder.svg',
    description: 'Challenging trail with steep climbs, fast descents, and rugged terrain designed for highly skilled riders.',
    mapLink: 'https://maps.app.goo.gl/3cZ8NEZ4eJFjD8bo6',
  },
};

const FALLBACK_META: LocationMeta = {
  image: '/locations/location-placeholder.svg',
  description: 'Scenic guided ride with route details tailored to your selected tour style and skill level.',
  mapLink: 'https://maps.google.com',
};

// ─── TrailLocationCard ────────────────────────────────────────────────────────

interface TrailLocationCardProps {
  location: Location;
  onSelect: () => void;
}

function TrailLocationCard({ location, onSelect }: TrailLocationCardProps) {
  const meta = LOCATION_CONTENT[location.name] ?? FALLBACK_META;
  const [hovered, setHovered] = useState(false);

  // Extract a display name (strip "(First Time)" suffix added for uniqueness)
  const displayName = location.name.replace(' (First Time)', '');

  return (
    <div
      className="flex flex-col rounded-xl border border-border/80 bg-card overflow-hidden
                 transition-all duration-250 ease-in-out
                 hover:border-green-500 hover:shadow-lg hover:-translate-y-1"
    >
      {/* Image / Map preview */}
      <div
        className="relative aspect-[4/3] w-full overflow-hidden cursor-pointer select-none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onSelect}
      >
        {/* Trail image */}
        <Image
          src={meta.image}
          alt={displayName}
          fill
          className={`object-cover transition-opacity duration-300 ${hovered ? 'opacity-0' : 'opacity-100'}`}
        />

        {/* Map overlay — desktop hover only */}
        <div
          className={`absolute inset-0 hidden sm:flex flex-col items-center justify-center gap-3
                      bg-gradient-to-br from-slate-900/95 to-slate-800/95
                      transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <span className="text-3xl">📍</span>
            <p className="text-sm font-medium text-white leading-snug">{displayName}</p>
            <a
              href={meta.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/20
                         border border-white/20 px-3 py-1.5 text-xs font-medium text-white
                         transition-colors duration-150"
            >
              Open in Google Maps →
            </a>
          </div>
        </div>

        {/* Trail type badge — always visible */}
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="secondary" className="text-xs font-medium shadow">
            {location.tour_type === 'paved' ? 'Paved' : 'MTB'}
          </Badge>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <h3 className="font-semibold text-sm leading-snug text-foreground">{displayName}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">{meta.description}</p>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
            onClick={onSelect}
          >
            Select Location
          </Button>
          <a
            href={meta.mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-border
                       bg-background hover:bg-muted px-3 text-xs font-medium text-muted-foreground
                       hover:text-foreground transition-colors duration-150 shrink-0"
          >
            View Map
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── StepLocation ─────────────────────────────────────────────────────────────

export function StepLocation() {
  const { state, setLocation, goNext, goPrev } = useBooking();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    getLocations()
      .then((data) => setLocations(data as Location[]))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = locations.filter((loc) => {
    if (loc.tour_type !== state.trail_type) return false;
    if (loc.skill_levels && state.skill_level) {
      return loc.skill_levels.includes(state.skill_level);
    }
    return true;
  });

  const handleSelect = (location: Location) => {
    setLocation(location.id, location.name);
    goNext();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Choose Your Location</h2>
        <p className="text-muted-foreground mt-1">
          Select where you&apos;d like to ride.
          {state.skill_level && (
            <span className="ml-1 text-green-600 font-medium">
              Showing trails for your skill level.
            </span>
          )}
        </p>
      </div>

      <Button variant="ghost" onClick={goPrev} className="mb-4 text-muted-foreground">
        ← Back
      </Button>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading locations...</div>
      ) : loadError ? (
        <div className="text-center py-8 text-destructive">
          Unable to load locations. Please refresh the page and try again.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No locations available for your selection. Please go back and try different options.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((location) => (
            <TrailLocationCard
              key={location.id}
              location={location}
              onSelect={() => handleSelect(location)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
