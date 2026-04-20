const LOCALHOST_HOSTS = ['localhost', '127.0.0.1'];

export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!raw) {
    if (isProduction) {
      throw new Error('NEXT_PUBLIC_APP_URL must be configured in production');
    }
    return 'http://localhost:3000';
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`NEXT_PUBLIC_APP_URL is not a valid URL: ${raw}`);
  }

  if (isProduction && LOCALHOST_HOSTS.includes(parsed.hostname)) {
    throw new Error('NEXT_PUBLIC_APP_URL cannot point to localhost in production');
  }

  return raw.replace(/\/$/, '');
}

export function isLocalOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return LOCALHOST_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}
