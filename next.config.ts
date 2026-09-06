import type { NextConfig } from "next";

/**
 * Canonical host for the public site. The Vercel project also answers on
 * fmbgt.vercel.app, which served the full site with a 200 — Google found it and
 * reported it as a referring page. The pages already carry a cross-domain
 * canonical pointing here, but a canonical is a hint and a redirect is a
 * directive, so we send the alias here outright.
 */
const CANONICAL_ORIGIN = 'https://www.floridamountainbikeguides.com';

/**
 * Only the stable project alias. Preview deployments get their own hostnames
 * (fmbgt-<hash>-<team>.vercel.app); matching *.vercel.app would redirect those
 * to production and make previews impossible to test before merging.
 */
const VERCEL_ALIAS_HOST = 'fmbgt.vercel.app';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nhgpxegozgljqebxqtnq.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async redirects() {
    const onAliasHost = [{ type: 'host' as const, value: VERCEL_ALIAS_HOST }];

    return [
      {
        source: '/',
        has: onAliasHost,
        destination: CANONICAL_ORIGIN,
        permanent: true,
      },
      {
        // Everything except /api/*. Stripe does not follow redirects when
        // delivering webhooks, and the cron paths in vercel.json are POSTed
        // directly — if any of them is registered against the alias host, a
        // blanket redirect would silently break payments or the nightly jobs.
        // API routes are Disallowed in robots.txt anyway, so excluding them
        // costs nothing for indexing.
        source: '/:path((?!api/).*)',
        has: onAliasHost,
        destination: `${CANONICAL_ORIGIN}/:path`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
