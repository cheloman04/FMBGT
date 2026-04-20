const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1']);
const DEFAULT_PRODUCTION_SITE_URL = 'https://www.floridamountainbikeguides.com';
const DEFAULT_DEVELOPMENT_SITE_URL = 'http://localhost:3000';

function normalizeUrl(url: string) {
  return url.replace(/\/$/, '');
}

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (raw) {
    try {
      const parsed = new URL(raw);
      const isLocalhost = LOCALHOST_HOSTS.has(parsed.hostname);

      if (process.env.NODE_ENV !== 'production' || !isLocalhost) {
        return normalizeUrl(raw);
      }
    } catch {
      // Ignore malformed env values here and fall back to a safe default for metadata.
    }
  }

  return process.env.NODE_ENV === 'production'
    ? DEFAULT_PRODUCTION_SITE_URL
    : DEFAULT_DEVELOPMENT_SITE_URL;
}
