import type { Addons, BikeRental, InventoryStatus } from '@/types/booking';
import { getSupabaseAdmin } from './supabase';

export const INVENTORY_ITEMS = {
  ELECTRIC_BIKE: 'electric_bike',
  GOPRO: 'gopro',
  STANDARD_BIKE: 'standard_bike',
} as const;

// Count how many units of an item are reserved on a given date
async function countReservedOnDate(item: string, date: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  // Electric bikes: must sum across lead rider AND additional riders in participant_info JSONB
  if (item === INVENTORY_ITEMS.ELECTRIC_BIKE) {
    const { data, error } = await supabase
      .from('bookings')
      .select('bike_rental, participant_info')
      .eq('date', date)
      .in('status', ['pending', 'confirmed']);
    if (error) throw error;

    let total = 0;
    for (const booking of data ?? []) {
      if (booking.bike_rental === 'electric') total++;
      const participants = booking.participant_info as Array<{ bike_rental?: string }> | null;
      if (Array.isArray(participants)) {
        total += participants.filter((p) => p.bike_rental === 'electric').length;
      }
    }
    return total;
  }

  let query = supabase
    .from('bookings')
    .select('id', { count: 'exact' })
    .eq('date', date)
    .in('status', ['pending', 'confirmed']);

  if (item === INVENTORY_ITEMS.GOPRO) {
    query = query.contains('addons', { gopro: true });
  } else if (item === INVENTORY_ITEMS.STANDARD_BIKE) {
    query = query.in('bike_rental', ['standard', 'electric']);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

// Get total inventory quantity for an item
async function getTotalInventory(item: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('item', item)
    .single();

  if (error) throw error;
  return data?.quantity ?? 0;
}

// Check availability for a specific item on a date
export async function checkItemAvailability(
  item: string,
  date: string
): Promise<InventoryStatus> {
  const [total, reserved] = await Promise.all([
    getTotalInventory(item),
    countReservedOnDate(item, date),
  ]);

  return {
    item,
    quantity: total,
    available: Math.max(0, total - reserved),
  };
}

// Validate full booking inventory requirements
export async function validateBookingInventory(
  date: string,
  bikeRental: BikeRental,
  addons: Addons,
  additionalParticipants?: Array<{ bike_rental?: string }>
): Promise<{ valid: boolean; errors: string[]; inventory: Record<string, InventoryStatus> }> {
  const errors: string[] = [];
  const inventoryChecks: Record<string, InventoryStatus> = {};

  // Count total electric riders across all participants
  const additionalElectric = additionalParticipants?.filter((p) => p.bike_rental === 'electric').length ?? 0;
  const totalElectricNeeded = (bikeRental === 'electric' ? 1 : 0) + additionalElectric;
  const totalBikesNeeded = (bikeRental === 'standard' || bikeRental === 'electric' ? 1 : 0)
    + (additionalParticipants?.filter((p) => p.bike_rental === 'standard' || p.bike_rental === 'electric').length ?? 0);

  const checksToRun: Array<{ item: string; needed: boolean; count: number; errorMessage: string }> = [
    {
      item: INVENTORY_ITEMS.ELECTRIC_BIKE,
      needed: totalElectricNeeded > 0 || !!addons.electric_upgrade,
      count: totalElectricNeeded,
      errorMessage: 'Electric bikes are fully booked for this date. Please choose a standard bike or select a different date.',
    },
    {
      item: INVENTORY_ITEMS.GOPRO,
      needed: !!addons.gopro,
      count: 1,
      errorMessage: 'GoPro cameras are fully booked for this date. Please select a different date.',
    },
    {
      item: INVENTORY_ITEMS.STANDARD_BIKE,
      needed: totalBikesNeeded > 0,
      count: totalBikesNeeded,
      errorMessage: 'Bikes are fully booked for this date. Please select a different date or choose "No bike rental".',
    },
  ];

  await Promise.all(
    checksToRun.map(async ({ item, needed, count, errorMessage }) => {
      if (!needed) return;
      const status = await checkItemAvailability(item, date);
      inventoryChecks[item] = status;
      if (status.available < count) {
        errors.push(errorMessage);
      }
    })
  );

  return {
    valid: errors.length === 0,
    errors,
    inventory: inventoryChecks,
  };
}

// Check if electric bike option should be shown as available
export async function isElectricBikeAvailable(date: string): Promise<boolean> {
  if (!date) return true; // Show as available before date is selected
  const status = await checkItemAvailability(INVENTORY_ITEMS.ELECTRIC_BIKE, date);
  return status.available > 0;
}
