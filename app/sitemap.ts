import type { MetadataRoute } from 'next';
import { CITIES } from '@/data/cities';
import { TRAILS } from '@/data/trails';
import { getSiteUrl } from '@/lib/site-url';

/**
 * Generated from the same data modules that build the pages, so a trail or city
 * added to data/ appears here automatically. A hand-maintained list drifts the
 * moment someone adds a page and forgets this file.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  const core: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/booking`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${siteUrl}/booking/lookup`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
  ];

  const cities: MetadataRoute.Sitemap = CITIES.map((city) => ({
    url: `${siteUrl}/tours/${city.slug}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const trails: MetadataRoute.Sitemap = TRAILS.map((trail) => ({
    url: `${siteUrl}/trails/${trail.slug}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const guides: MetadataRoute.Sitemap = [
    'central-florida-mountain-bike-trails',
    'beginner-mountain-biking-orlando',
    'blue-spring-manatee-bike-tour',
  ].map((slug) => ({
    url: `${siteUrl}/guides/${slug}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...core, ...cities, ...trails, ...guides];
}
