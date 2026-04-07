import type { Metadata } from 'next';
import Script from 'next/script';
import FloridaMountainBikeGuidesLanding from '@/components/landing/FloridaMountainBikeGuidesLanding';

// ─────────────────────────────────────────────
// Page-level SEO metadata
// ─────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Guided Mountain Bike Tours in Central Florida | Florida Mountain Bike Guides',
  description:
    'Expert-guided mountain bike and paved trail tours across Central Florida. Bikes included, all skill levels welcome. Ride Sanford, Mount Dora, Ocala, and beyond.',
  metadataBase: new URL('https://fmbgt.vercel.app'),
  alternates: {
    canonical: 'https://fmbgt.vercel.app',
  },
  openGraph: {
    title: 'Guided Mountain Bike Tours in Central Florida | Florida Mountain Bike Guides',
    description:
      'Expert-guided mountain bike and paved trail tours across Central Florida. Bikes included, all skill levels welcome. Ride Sanford, Mount Dora, Ocala, and beyond.',
    url: 'https://fmbgt.vercel.app',
    siteName: 'Florida Mountain Bike Guides',
    images: [
      {
        url: 'https://fmbgt.vercel.app/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Guided mountain bike tour on a Central Florida trail — Florida Mountain Bike Guides',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Guided Mountain Bike Tours in Central Florida | Florida Mountain Bike Guides',
    description:
      'All skill levels. Bikes included. Local guides. Book your Central Florida trail adventure today.',
    images: ['https://fmbgt.vercel.app/og-image.jpg'],
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
  url: 'https://fmbgt.vercel.app',
  logo: 'https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png',
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
  url: 'https://fmbgt.vercel.app',
  logo: 'https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png',
  image: 'https://fmbgt.vercel.app/og-image.jpg',
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
        url: 'https://fmbgt.vercel.app/booking',
      },
      {
        '@type': 'Offer',
        name: 'Scenic Paved Trail Tour',
        description:
          'Relaxed guided paved trail ride through historic Sanford, Blue Spring, and scenic Central Florida riverfront routes.',
        url: 'https://fmbgt.vercel.app/booking',
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

export default function HomePage() {
  return (
    <>
      <Script
        id="schema-organization"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Script
        id="schema-local-business"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <FloridaMountainBikeGuidesLanding />
    </>
  );
}
