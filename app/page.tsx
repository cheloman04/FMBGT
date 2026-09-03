import type { Metadata } from 'next';
import FloridaMountainBikeGuidesLanding from '@/components/landing/FloridaMountainBikeGuidesLanding';
import { getSiteUrl } from '@/lib/site-url';

const SITE_URL = getSiteUrl();
const LOGO_URL =
  'https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png';

// ─────────────────────────────────────────────
// Page-level SEO metadata
// ─────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Guided Mountain Bike Tours in Central Florida | Florida Mountain Bike Guides',
  description:
    'Expert-guided mountain bike and paved trail tours across Central Florida. Bikes included, all skill levels welcome. Ride Sanford, Mount Dora, Ocala, and beyond.',
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: 'Guided Mountain Bike Tours in Central Florida | Florida Mountain Bike Guides',
    description:
      'Expert-guided mountain bike and paved trail tours across Central Florida. Bikes included, all skill levels welcome. Ride Sanford, Mount Dora, Ocala, and beyond.',
    url: SITE_URL,
    siteName: 'Florida Mountain Bike Guides',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Guided Mountain Bike Tours in Central Florida | Florida Mountain Bike Guides',
    description:
      'All skill levels. Bikes included. Local guides. Book your Central Florida trail adventure today.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// ─────────────────────────────────────────────
// JSON-LD structured data
// ─────────────────────────────────────────────
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Florida Mountain Bike Guides',
  alternateName: 'FMBGT',
  url: SITE_URL,
  logo: LOGO_URL,
  foundingDate: '2024',
  description:
    'Guided mountain bike and paved trail tours across Central Florida for all skill levels. Bikes and gear provided.',
  areaServed: {
    '@type': 'State',
    name: 'Florida',
  },
  sameAs: [
    'https://www.facebook.com/floridamountainbikeguides',
    'https://www.instagram.com/FloridaMountainBikeGuides',
    'https://www.youtube.com/@FloridaMountainBikeGuides',
    'https://www.threads.com/@floridamountainbikeguides',
  ],
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'TouristAttraction'],
  name: 'Florida Mountain Bike Guides',
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
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 28.8012,
    longitude: -81.2726,
  },
  areaServed: [
    { '@type': 'City', name: 'Orlando, FL' },
    { '@type': 'City', name: 'Sanford, FL' },
    { '@type': 'City', name: 'Mount Dora, FL' },
    { '@type': 'City', name: 'DeLand, FL' },
    { '@type': 'City', name: 'Ocala, FL' },
    { '@type': 'City', name: 'Palm Coast, FL' },
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Guided Bike Tour Packages',
    itemListElement: [
      {
        '@type': 'Offer',
        name: 'Mountain Bike Guided Tour',
        description:
          'Guided singletrack mountain bike tour across Central Florida trails. Bikes and gear included. All skill levels.',
        url: `${SITE_URL}/booking`,
      },
      {
        '@type': 'Offer',
        name: 'Scenic Paved Trail Tour',
        description:
          'Relaxed guided paved trail ride through historic Sanford, Blue Spring, and scenic Central Florida riverfront routes.',
        url: `${SITE_URL}/booking`,
      },
    ],
  },
  sameAs: [
    'https://www.facebook.com/floridamountainbikeguides',
    'https://www.instagram.com/FloridaMountainBikeGuides',
    'https://www.youtube.com/@FloridaMountainBikeGuides',
    'https://www.threads.com/@floridamountainbikeguides',
  ],
};

// next/script injects its tag on the client, which left the structured data out
// of the server HTML entirely. A plain <script> renders it into the markup that
// crawlers read on the first pass.
function jsonLd(schema: object) {
  return { __html: JSON.stringify(schema).replace(/</g, '\\u003c') };
}

export default function HomePage() {
  return (
    <>
      <script
        id="schema-organization"
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(organizationSchema)}
      />
      <script
        id="schema-local-business"
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(localBusinessSchema)}
      />
      <FloridaMountainBikeGuidesLanding />
    </>
  );
}
