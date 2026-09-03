import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';
import { BookingFlowClient } from './BookingFlowClient';

const SITE_URL = getSiteUrl();

// Rendered by app/opengraph-image.tsx. Declaring `openGraph` here replaces the
// inherited file-convention image, so point at it explicitly.
const OG_IMAGE = `${SITE_URL}/opengraph-image`;

const TITLE = 'Book a Guided Bike Tour in Central Florida | Florida Mountain Bike Guides';
const DESCRIPTION =
  'Reserve your guided mountain bike or paved trail tour in Central Florida. Pick your trail, date, and bike — rentals included, all skill levels welcome.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: `${SITE_URL}/booking`,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/booking`,
    siteName: 'Florida Mountain Bike Guides',
    locale: 'en_US',
    type: 'website',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_URL}/twitter-image`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function BookingPage() {
  return <BookingFlowClient />;
}
