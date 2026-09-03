import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';
import { LookupClient } from './LookupClient';

const SITE_URL = getSiteUrl();

// Rendered by app/opengraph-image.tsx. Declaring `openGraph` here replaces the
// inherited file-convention image, so point at it explicitly.
const OG_IMAGE = `${SITE_URL}/opengraph-image`;

const TITLE = 'Find My Booking | Florida Mountain Bike Guides';
const DESCRIPTION =
  'Look up an existing Florida Mountain Bike Guides tour reservation to review your trail, date, time, and meeting location.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: `${SITE_URL}/booking/lookup`,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/booking/lookup`,
    siteName: 'Florida Mountain Bike Guides',
    locale: 'en_US',
    type: 'website',
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LookupPage() {
  return <LookupClient />;
}
