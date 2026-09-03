/**
 * Structured data builders shared by every page.
 *
 * All JSON-LD is rendered into the server HTML with a plain <script> tag —
 * never next/script, which injects on the client and leaves the markup empty
 * on a crawler's first pass.
 */

import { PRICING } from '@/lib/pricing';
import { getSiteUrl } from '@/lib/site-url';
import type { FaqItem } from '@/data/faqs';
import type { Trail } from '@/data/trails';

export const SITE_URL = getSiteUrl();
export const BRAND = 'Florida Mountain Bike Guides';
export const LOGO_URL =
  'https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png';

export const SOCIAL_PROFILES = [
  'https://www.facebook.com/floridamountainbikeguides',
  'https://www.instagram.com/FloridaMountainBikeGuides',
  'https://www.youtube.com/@FloridaMountainBikeGuides',
  'https://www.threads.com/@floridamountainbikeguides',
];

const dollars = (cents: number) => (cents / 100).toFixed(2);

/**
 * Serialize a schema object for dangerouslySetInnerHTML.
 * `<` is escaped so a stray "</script>" inside any string cannot close the tag.
 */
export function jsonLd(schema: object) {
  return { __html: JSON.stringify(schema).replace(/</g, '\\u003c') };
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export interface Crumb {
  name: string;
  /** Absolute URL. Omit on the current page — the last crumb needs no item. */
  url?: string;
}

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      ...(crumb.url ? { item: crumb.url } : {}),
    })),
  };
}

/**
 * The two tours, priced from lib/pricing.ts so the markup can never drift from
 * what checkout actually charges.
 *
 * MTB is an AggregateOffer because the price genuinely varies: $89 riding your
 * own bike, $189 with a rental. Quoting only the low number as a fixed `price`
 * would be a misrepresentation Google is entitled to penalise.
 */
export function tourOffers() {
  return [
    {
      '@type': 'Offer',
      name: 'Mountain Bike Guided Tour',
      description:
        'Guided singletrack mountain bike tour across Central Florida trails. All skill levels. Bring your own bike or ride one of ours.',
      url: `${SITE_URL}/booking`,
      priceSpecification: {
        '@type': 'PriceSpecification',
        minPrice: dollars(PRICING.BASE_NO_BIKE),
        maxPrice: dollars(PRICING.BASE_WITH_BIKE),
        priceCurrency: 'USD',
      },
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Scenic Paved Trail Tour',
      description:
        'Relaxed guided paved trail ride through historic Sanford, Blue Spring, and scenic Central Florida riverfront routes. Bike included.',
      url: `${SITE_URL}/booking`,
      price: dollars(PRICING.PAVED_FLAT),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  ];
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND,
    alternateName: 'FMBGT',
    url: SITE_URL,
    logo: LOGO_URL,
    foundingDate: '2024',
    description:
      'Guided mountain bike and paved trail tours across Central Florida for all skill levels. Bikes and gear provided.',
    areaServed: { '@type': 'State', name: 'Florida' },
    sameAs: SOCIAL_PROFILES,
  };
}

export function localBusinessSchema(areaServed: string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'TouristAttraction'],
    name: BRAND,
    description:
      'Guided mountain bike and scenic paved trail tours across Central Florida. All skill levels welcome. Bikes and gear provided at the trailhead.',
    url: SITE_URL,
    logo: LOGO_URL,
    image: LOGO_URL,
    foundingDate: '2024',
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Sanford',
      addressRegion: 'FL',
      addressCountry: 'US',
    },
    geo: { '@type': 'GeoCoordinates', latitude: 28.8012, longitude: -81.2726 },
    areaServed: areaServed.map((name) => ({ '@type': 'City', name })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Guided Bike Tour Packages',
      itemListElement: tourOffers(),
    },
    sameAs: SOCIAL_PROFILES,
  };
}

/**
 * A guided tour at one trail. `TouristTrip` is the closest fit: a routed
 * experience sold as a product, rather than the trail itself as a place.
 */
export function trailTourSchema(trail: Trail) {
  const isPaved = trail.terrain === 'paved';
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: `Guided ${isPaved ? 'Paved Trail' : 'Mountain Bike'} Tour — ${trail.name}`,
    description: trail.description,
    url: `${SITE_URL}/trails/${trail.slug}`,
    touristType: trail.difficulty,
    provider: {
      '@type': 'LocalBusiness',
      name: BRAND,
      url: SITE_URL,
      logo: LOGO_URL,
    },
    itinerary: {
      '@type': 'Place',
      name: trail.meetingPointName,
      address: {
        '@type': 'PostalAddress',
        streetAddress: trail.meetingPointAddress,
        addressLocality: trail.city,
        addressRegion: 'FL',
        addressCountry: 'US',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: trail.lat,
        longitude: trail.lng,
      },
    },
    offers: isPaved
      ? {
          '@type': 'Offer',
          url: `${SITE_URL}/booking`,
          price: dollars(PRICING.PAVED_FLAT),
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        }
      : {
          '@type': 'Offer',
          url: `${SITE_URL}/booking`,
          priceSpecification: {
            '@type': 'PriceSpecification',
            minPrice: dollars(PRICING.BASE_NO_BIKE),
            maxPrice: dollars(PRICING.BASE_WITH_BIKE),
            priceCurrency: 'USD',
          },
          availability: 'https://schema.org/InStock',
        },
  };
}
