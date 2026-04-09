'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ExternalLink, MapPin } from 'lucide-react';
import { useBooking } from '@/context/BookingContext';
import { getLocations } from '@/lib/supabase';
import type { Location } from '@/types/booking';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookingStepActions } from '@/components/BookingStepActions';

interface LocationMeta {
  image: string;
  description: string;
  mapLink: string;
}

function normalizeLocationKey(value: string) {
  return value
    .normalize('NFKC')
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“|Ã¢â‚¬â€œ|â€“|–/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

const LOCATION_CONTENT: Record<string, LocationMeta> = {
  'Sanford Historic Riverfront Tour': {
    image: '/images/tours/location-downtown-sanford.png',
    description:
      "Explore Sanford's historic district and scenic riverfront on a relaxing ride through oak-lined streets, local shops, and vibrant downtown charm.",
    mapLink: 'https://maps.app.goo.gl/UQL4WTkzoXVSG4Ti8',
  },
  'Spring to Spring Trail Tour - Blue Spring State Park': {
    image: '/images/tours/location-spring-to-spring.png',
    description:
      'A scenic trail ride to Blue Spring State Park featuring clear springs, wildlife, and seasonal manatee sightings.',
    mapLink: 'https://maps.app.goo.gl/imgUh7LBef9cLj2d7',
  },
  'Lake Druid Park, Orlando': {
    image: '/images/tours/location-lake-druid-park.png',
    description:
      'Wide beginner-friendly trails perfect for learning the basics of mountain biking in a safe and open environment.',
    mapLink: 'https://maps.app.goo.gl/WjApuDjQubbBJJBQ6',
  },
  'Soldiers Creek Park, Longwood (First Time)': {
    image: '/images/tours/location-soldiers-creek.png',
    description:
      'Smooth and easy trails ideal for practicing balance, braking, and turning while building confidence on dirt.',
    mapLink: 'https://maps.app.goo.gl/Xq7WKPN9pFJuGZGw8',
  },
  'Markham Woods Trail, Lake Mary': {
    image: '/images/tours/location-markham-woods.png',
    description:
      'Flowing forest trails with light roots and gentle turns, perfect for riders ready to improve control and bike handling.',
    mapLink: 'https://maps.app.goo.gl/u7hqJcQw9RGL16PaA',
  },
  'Little Big Econ Jones East - Snow Hill Rd, Chuluota': {
    image: '/images/tours/location-econ-jones.png',
    description:
      'A scenic trail through pine forest with smooth sections and gentle climbs, great for riders stepping up from beginner level.',
    mapLink: 'https://maps.app.goo.gl/KiEEaaJXGJbDHo7r7',
  },
  'Soldiers Creek Park, Longwood': {
    image: '/images/tours/location-soldiers-creek.png',
    description:
      'Fun and approachable trails with mild technical features, ideal for improving skills while keeping the ride enjoyable.',
    mapLink: 'https://maps.app.goo.gl/Xq7WKPN9pFJuGZGw8',
  },
  'Mount Dora Mountain Bike Trail, Mount Dora': {
    image: '/images/tours/location-mount-dora-mountain-bike-trail-fl.png',
    description:
      'Technical trail system with climbs, descents, and optional jumps designed for riders ready for a bigger challenge.',
    mapLink: 'https://maps.app.goo.gl/FQtUAx8ZS2zwpQpZ7',
  },
  'Chuck Lennon Mountain Bike Trailhead, DeLeon Springs': {
    image: '/images/tours/location-chuck-lenon-mountain-delon-springs-fl.png',
    description:
      'Flowing singletrack with roots, climbs, and fast sections that challenge riders while rewarding strong control.',
    mapLink: 'https://maps.app.goo.gl/Q9oC3jfyLHGtddkZ8',
  },
  'River Bend, Ormond Beach': {
    image: '/images/tours/location-river-bend.png',
    description:
      'A scenic trail with tight tree lines, roots, and flowing terrain that tests balance and bike handling skills.',
    mapLink: 'https://maps.app.goo.gl/m9wLtSRAV9dNCuhR6',
  },
  'Doris Leeper Spruce Creek MTB Trailhead, Port Orange': {
    image: '/images/tours/location-spruce-creek.png',
    description:
      'Fast and technical trails with roots and flowing sections, ideal for riders looking to sharpen their technique.',
    mapLink: 'https://maps.app.goo.gl/F1qUgb47Yj5K4MZn7',
  },
  'Santos Trailhead, Ocala': {
    image: '/images/tours/location-santos-trailhead-ocala-fl.png',
    description:
      'World-class mountain bike destination featuring jumps, drops, and technical terrain for expert riders.',
    mapLink: 'https://maps.app.goo.gl/YVVXwnwXZiTaJ4tT6',
  },
  'Graham Swamp East Trailhead MTB, Palm Coast': {
    image: '/images/tours/location-graham-swamp-2.png',
    description:
      'Challenging trail with steep climbs, fast descents, and rugged terrain designed for highly skilled riders.',
    mapLink: 'https://maps.app.goo.gl/3cZ8NEZ4eJFjD8bo6',
  },
};

const NORMALIZED_LOCATION_CONTENT: Record<string, LocationMeta> = Object.fromEntries(
  Object.entries(LOCATION_CONTENT).map(([name, meta]) => [normalizeLocationKey(name), meta])
);

const FALLBACK_META: LocationMeta = {
  image: '/locations/location-placeholder.svg',
  description: 'Scenic guided ride with route details tailored to your selected tour style and skill level.',
  mapLink: 'https://maps.google.com',
};

interface TrailLocationCardProps {
  location: Location;
  onSelect: () => void;
}

function TrailLocationCard({ location, onSelect }: TrailLocationCardProps) {
  const meta =
    LOCATION_CONTENT[location.name] ??
    NORMALIZED_LOCATION_CONTENT[normalizeLocationKey(location.name)] ??
    FALLBACK_META;
  const [hovered, setHovered] = useState(false);

  const displayName = normalizeLocationKey(location.name).replace(' (First Time)', '');

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card transition-all duration-250 ease-in-out hover:-translate-y-1 hover:border-green-500 hover:shadow-lg"
    >
      <div
        className="relative aspect-[4/3] w-full cursor-pointer select-none overflow-hidden"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onSelect}
      >
        <Image
          src={meta.image}
          alt={displayName}
          fill
          className={`object-cover transition-opacity duration-300 ${hovered ? 'opacity-0' : 'opacity-100'}`}
        />

        <div
          className={`absolute inset-0 hidden flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-900/95 to-slate-800/95 transition-opacity duration-300 sm:flex ${hovered ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <MapPin className="h-8 w-8 text-white" aria-hidden="true" />
            <p className="text-sm font-medium leading-snug text-white">{displayName}</p>
            <a
              href={meta.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/20"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="absolute right-2 top-2 z-10">
          <Badge variant="secondary" className="text-xs font-medium shadow">
            {location.tour_type === 'paved' ? 'Paved' : 'MTB'}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold leading-snug text-foreground">{displayName}</h3>
        <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{meta.description}</p>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 bg-green-600 text-xs text-white hover:bg-green-700"
            onClick={onSelect}
          >
            Select Location
          </Button>
          <a
            href={meta.mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            View Map
          </a>
        </div>
      </div>
    </div>
  );
}

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
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-foreground">Choose Your Location</h2>
        <p className="mt-1 text-muted-foreground">
          Select where you&apos;d like to ride.
          {state.skill_level && (
            <span className="ml-1 font-medium text-green-600">
              Showing trails for your skill level.
            </span>
          )}
        </p>
      </div>

      <BookingStepActions onBack={goPrev} />

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading locations...</div>
      ) : loadError ? (
        <div className="py-8 text-center text-destructive">
          Unable to load locations. Please refresh the page and try again.
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
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
