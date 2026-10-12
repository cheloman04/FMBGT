// Ride locations that are shown to riders but can't be booked yet ("Coming Soon").
//
// Matched by the booking location's name (the `locations` table). The public
// trail pages flag the same rides with `comingSoon` in data/trails.ts — keep the
// two in step. To open a location for booking, remove it here and clear its
// trail flag.

const COMING_SOON_LOCATIONS = ['Spring to Spring Trail Tour - Blue Spring State Park'];

// Location names have been stored with both "-" and "–" (see lib/cal.ts).
function normalizeLocationName(name: string): string {
  return name.normalize('NFKC').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
}

const COMING_SOON = new Set(COMING_SOON_LOCATIONS.map(normalizeLocationName));

export const COMING_SOON_MESSAGE = 'This location is coming soon and can’t be booked yet.';

export function isLocationComingSoon(name: string | null | undefined): boolean {
  return Boolean(name) && COMING_SOON.has(normalizeLocationName(name as string));
}
