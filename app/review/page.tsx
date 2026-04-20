import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';
import { ReviewPageClient, type ReviewPageProps } from './ReviewPageClient';

const SITE_URL = getSiteUrl();

type ReviewSearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: 'Leave a Review | Florida Mountain Bike Guides',
  description:
    'Thanks for riding with Florida Mountain Bike Guides. Share your experience and help more riders discover us.',
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: `${SITE_URL}/review`,
  },
  openGraph: {
    title: 'Leave a Review | Florida Mountain Bike Guides',
    description:
      'Thanks for riding with Florida Mountain Bike Guides. Share your experience and help more riders discover us.',
    url: `${SITE_URL}/review`,
    siteName: 'Florida Mountain Bike Guides',
    type: 'website',
  },
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: ReviewSearchParams;
}) {
  const params = await searchParams;
  return <ReviewPageClient params={params as ReviewPageProps['params']} />;
}
