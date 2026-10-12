// Rental-fleet arithmetic shared by the server inventory checks (lib/inventory.ts)
// and the booking calendar. Pure — safe to import from client components.

export interface BikeCounts {
  bikes: number;    // all rental bikes (standard + electric) — the shared fleet
  electric: number; // the electric subset
}

export interface BikeCountRow {
  bike_rental?: string | null;
  participant_info?: unknown;
  addons?: { electric_upgrade?: boolean } | null;
}

/**
 * Rental bikes one booking takes: one per rider on a standard or electric bike.
 * Additional riders without their own bike choice (manual bookings only store
 * names) ride what the lead rider rides. Mirrors booking_bike_counts() in
 * supabase/migrations/033_inventory_per_rider.sql — keep them in sync.
 */
export function bookingBikeCounts(row: BikeCountRow): BikeCounts {
  const lead = row.bike_rental ?? 'none';
  const others = Array.isArray(row.participant_info)
    ? (row.participant_info as Array<{ bike_rental?: string | null } | null>)
    : [];
  const rentals = [lead, ...others.map((p) => p?.bike_rental ?? lead)];

  let bikes = 0;
  let electric = 0;
  for (const rental of rentals) {
    if (rental === 'standard' || rental === 'electric') bikes++;
    if (rental === 'electric') electric++;
  }
  // Legacy paved bookings stored the lead's e-bike as an add-on on a standard bike.
  if (row.addons?.electric_upgrade && lead !== 'electric') electric++;

  return { bikes, electric };
}

/** True when the fleet left over after `used` can't seat `needed`. */
export function lacksBikes(totals: BikeCounts, used: BikeCounts, needed: BikeCounts): boolean {
  return totals.bikes - used.bikes < needed.bikes || totals.electric - used.electric < needed.electric;
}
