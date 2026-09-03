/**
 * Canonical ride-location dataset.
 *
 * Single source of truth for the interactive map, the server-rendered trail
 * directory, the /trails/[slug] pages, the /tours/[city] pages and the sitemap.
 *
 * Everything here is first-party: names, difficulty and descriptions come from
 * the landing copy, meeting-point addresses from the booking flow
 * (lib/location-meta.ts), coordinates and Maps links from the map component.
 * Nothing is estimated — if a fact is not in one of those sources it is not
 * here, because these pages are public claims about a real business.
 */

export type Difficulty = 'First Time' | 'Beginner' | 'Intermediate' | 'Advanced';
export type TerrainType = 'mtb' | 'paved';

export interface Trail {
  slug: string;
  name: string;
  /** City label shown to riders — matches how the tour is sold. */
  city: string;
  /** City page this trail belongs to (data/cities.ts). */
  cityKey: string;
  difficulty: Difficulty;
  terrain: TerrainType;
  /** Rider-facing description, as written on the landing page. */
  description: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  meetingPointName: string;
  meetingPointAddress: string;
}

export const DIFFICULTY_ORDER: Difficulty[] = [
  'First Time',
  'Beginner',
  'Intermediate',
  'Advanced',
];

/** How each rating is explained to riders, in the operator's own terms. */
export const DIFFICULTY_COPY: Record<Difficulty, string> = {
  'First Time':
    'Never ridden off-road before. Wide, open trail with no technical features — the guide covers the basics before you roll out.',
  Beginner:
    'Comfortable on a bike and ready for dirt. Light roots and gentle turns, ridden at a pace that builds confidence.',
  Intermediate:
    'You have trail miles behind you. Roots, climbs and faster flowing sections that reward good control.',
  Advanced:
    'Technical terrain with real consequence — climbs, descents and features for riders who already ride hard.',
};

export const TRAILS: Trail[] = [
  {
    slug: 'lake-druid-park',
    name: 'Lake Druid Park',
    city: 'Orlando',
    cityKey: 'orlando',
    difficulty: 'First Time',
    terrain: 'mtb',
    description:
      'Wide beginner-friendly trails perfect for learning the basics of mountain biking in a safe and open environment.',
    lat: 28.5467,
    lng: -81.3765,
    mapsUrl: 'https://maps.app.goo.gl/WjApuDjQubbBJJBQ6',
    meetingPointName: 'Lake Druid Park',
    meetingPointAddress: '899 Coy Dr, Orlando, FL 32803',
  },
  {
    slug: 'soldiers-creek-park',
    name: 'Soldiers Creek Park',
    city: 'Longwood',
    cityKey: 'orlando',
    difficulty: 'First Time',
    terrain: 'mtb',
    description:
      'Smooth and easy trails ideal for practicing balance, braking, and turning while building confidence on dirt.',
    lat: 28.6978,
    lng: -81.3427,
    mapsUrl: 'https://maps.app.goo.gl/Xq7WKPN9pFJuGZGw8',
    meetingPointName: 'Soldiers Creek Park',
    meetingPointAddress: '2400 FL-419, Longwood, FL 32750',
  },
  {
    slug: 'markham-woods-trail',
    name: 'Markham Woods Trail',
    city: 'Lake Mary',
    cityKey: 'sanford',
    difficulty: 'Beginner',
    terrain: 'mtb',
    description:
      'Flowing forest trails with light roots and gentle turns, perfect for riders ready to improve control and bike handling.',
    lat: 28.7586,
    lng: -81.3179,
    mapsUrl: 'https://maps.app.goo.gl/u7hqJcQw9RGL16PaA',
    meetingPointName: 'Markham Woods Park',
    meetingPointAddress: '8515 Markham Rd, Lake Mary, FL 32746',
  },
  {
    slug: 'little-big-econ-jones-east',
    name: 'Little Big Econ Jones East',
    city: 'Chuluota',
    cityKey: 'orlando',
    difficulty: 'Beginner',
    terrain: 'mtb',
    description:
      'A scenic trail through pine forest with smooth sections and gentle climbs, great for riders stepping up from beginner level.',
    lat: 28.6197,
    lng: -81.0947,
    mapsUrl: 'https://maps.app.goo.gl/KiEEaaJXGJbDHo7r7',
    meetingPointName: 'Jones East Trailhead',
    meetingPointAddress: 'Snow Hill Rd, Chuluota, FL 32766',
  },
  {
    slug: 'mount-dora-mountain-bike-trail',
    name: 'Mount Dora Mountain Bike Trail',
    city: 'Mount Dora',
    cityKey: 'mount-dora',
    difficulty: 'Intermediate',
    terrain: 'mtb',
    description:
      'Technical trail system with climbs, descents, and optional jumps designed for riders ready for a bigger challenge.',
    lat: 28.8015,
    lng: -81.6448,
    mapsUrl: 'https://maps.app.goo.gl/FQtUAx8ZS2zwpQpZ7',
    meetingPointName: 'Mount Dora MTB Trailhead',
    meetingPointAddress: '1550 E 11th Ave, Mount Dora, FL 32757',
  },
  {
    slug: 'chuck-lennon-trailhead',
    name: 'Chuck Lennon MTB Trailhead',
    city: 'DeLeon Springs',
    cityKey: 'deland',
    difficulty: 'Intermediate',
    terrain: 'mtb',
    description:
      'Flowing singletrack with roots, climbs, and fast sections that challenge riders while rewarding strong control.',
    lat: 29.1304,
    lng: -81.3583,
    mapsUrl: 'https://maps.app.goo.gl/Q9oC3jfyLHGtddkZ8',
    meetingPointName: 'Chuck Lennon Park',
    meetingPointAddress: '5000 Greenfield Dairy Rd, DeLeon Springs, FL 32130',
  },
  {
    slug: 'river-bend',
    name: 'River Bend',
    city: 'Ormond Beach',
    cityKey: 'palm-coast',
    difficulty: 'Intermediate',
    terrain: 'mtb',
    description:
      'A scenic trail with tight tree lines, roots, and flowing terrain that tests balance and bike handling skills.',
    lat: 29.2852,
    lng: -81.0573,
    mapsUrl: 'https://maps.app.goo.gl/m9wLtSRAV9dNCuhR6',
    meetingPointName: 'River Bend Nature Park',
    meetingPointAddress: '755 Airport Rd, Ormond Beach, FL 32174',
  },
  {
    slug: 'doris-leeper-spruce-creek',
    name: 'Doris Leeper Spruce Creek MTB',
    city: 'Port Orange',
    cityKey: 'palm-coast',
    difficulty: 'Intermediate',
    terrain: 'mtb',
    description:
      'Fast and technical trails with roots and flowing sections, ideal for riders looking to sharpen their technique.',
    lat: 29.128,
    lng: -80.9967,
    mapsUrl: 'https://maps.app.goo.gl/F1qUgb47Yj5K4MZn7',
    meetingPointName: 'Spruce Creek',
    meetingPointAddress: '2317 Creek Shore Trail, New Smyrna Beach, FL 32168',
  },
  {
    slug: 'santos-trailhead',
    name: 'Santos Trailhead',
    city: 'Ocala',
    cityKey: 'ocala',
    difficulty: 'Advanced',
    terrain: 'mtb',
    description:
      'World-class mountain bike destination featuring jumps, drops, and technical terrain for expert riders.',
    lat: 29.1485,
    lng: -82.1234,
    mapsUrl: 'https://maps.app.goo.gl/YVVXwnwXZiTaJ4tT6',
    meetingPointName: 'Santos Trailhead & Campground',
    meetingPointAddress: '3080 SE 80th St, Ocala, FL 34480',
  },
  {
    slug: 'graham-swamp-east',
    name: 'Graham Swamp East Trailhead',
    city: 'Palm Coast',
    cityKey: 'palm-coast',
    difficulty: 'Advanced',
    terrain: 'mtb',
    description:
      'Challenging trail with steep climbs, fast descents, and rugged terrain designed for highly skilled riders.',
    lat: 29.5785,
    lng: -81.2165,
    mapsUrl: 'https://maps.app.goo.gl/3cZ8NEZ4eJFjD8bo6',
    meetingPointName: 'Graham Swamp East Trailhead',
    meetingPointAddress: 'Lehigh Trail Trailhead, Palm Coast, FL 32137',
  },

  // ── Paved tours ────────────────────────────────────────────────────────
  {
    slug: 'sanford-historic-riverfront',
    name: 'Sanford Historic Riverfront',
    city: 'Sanford',
    cityKey: 'sanford',
    difficulty: 'First Time',
    terrain: 'paved',
    description:
      'A relaxed paved ride through historic downtown Sanford and the Lake Monroe riverfront, starting from our partner bike shop.',
    lat: 28.8121,
    lng: -81.2723,
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=Downtown+Sanford%2C+Bicikleta+Bike+Shop%2C+229+Magnolia+Ave%2C+Sanford%2C+FL+32771',
    meetingPointName: 'Bicikleta Bike Shop, Downtown Sanford',
    meetingPointAddress: '229 Magnolia Ave, Sanford, FL 32771',
  },
  {
    slug: 'spring-to-spring-blue-spring',
    name: 'Spring to Spring Trail — Blue Spring State Park',
    city: 'DeLand',
    cityKey: 'deland',
    difficulty: 'First Time',
    terrain: 'paved',
    description:
      'A smooth paved trail ride toward Blue Spring State Park, with spring-fed water, shaded riverfront and seasonal manatee stops.',
    lat: 28.9483,
    lng: -81.3392,
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=Spring+to+Spring%2C+Blue+Springs+State+Park+-+Lake+Beresford+Park%2C+2100+Fatio+Rd%2C+DeLand%2C+FL+32720',
    meetingPointName: 'Lake Beresford Park, Spring to Spring Trail',
    meetingPointAddress: '2100 Fatio Rd, DeLand, FL 32720',
  },
];

export const MTB_TRAILS = TRAILS.filter((t) => t.terrain === 'mtb');
export const PAVED_TRAILS = TRAILS.filter((t) => t.terrain === 'paved');

export function getTrail(slug: string): Trail | undefined {
  return TRAILS.find((t) => t.slug === slug);
}

export function trailsForCity(cityKey: string): Trail[] {
  return TRAILS.filter((t) => t.cityKey === cityKey).sort(
    (a, b) =>
      DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty)
  );
}

export function trailsByDifficulty(difficulty: Difficulty): Trail[] {
  return TRAILS.filter((t) => t.difficulty === difficulty);
}
