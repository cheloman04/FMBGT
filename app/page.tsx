import type { Metadata } from 'next';
import FloridaMountainBikeGuidesLanding from '@/components/landing/FloridaMountainBikeGuidesLanding';
import { CITIES } from '@/data/cities';
import { faqItems } from '@/data/faqs';
import {
  SITE_URL,
  faqPageSchema,
  jsonLd,
  localBusinessSchema,
  organizationSchema,
} from '@/lib/seo';

const OG_IMAGE = `${SITE_URL}/opengraph-image`;

const TITLE = 'Guided Mountain Bike Tours in Central Florida | Florida Mountain Bike Guides';
const DESCRIPTION =
  'Expert-guided mountain bike and paved trail tours across Central Florida. Bikes included, all skill levels welcome. Ride Sanford, Mount Dora, Ocala, and beyond.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Florida Mountain Bike Guides',
    images: [OG_IMAGE],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description:
      'All skill levels. Bikes included. Local guides. Book your Central Florida trail adventure today.',
    images: [`${SITE_URL}/twitter-image`],
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  const areaServed = CITIES.map((c) => `${c.name}, FL`);

  return (
    <>
      <script
        id="schema-organization"
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(organizationSchema())}
      />
      <script
        id="schema-local-business"
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(localBusinessSchema(areaServed))}
      />
      {/* The eight questions below are the ones rendered in the FAQ accordion,
          read from the same module so markup and page can never disagree. */}
      <script
        id="schema-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(faqPageSchema(faqItems))}
      />
      <FloridaMountainBikeGuidesLanding />
    </>
  );
}
