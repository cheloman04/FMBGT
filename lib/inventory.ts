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

  let query = supabase
    .from('bookings')
    .select('id', { count: 'exact' })
    .eq('date', date)
    .in('status', ['pending', 'confirmed']);

  if (item === INVENTORY_ITEMS.ELECTRIC_BIKE) {
    query = query.eq('bike_rental', 'electric');
  } else if (item === INVENTORY_ITEMS.GOPRO) {
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
  addons: Addons
): Promise<{ valid: boolean; errors: string[]; inventory: Record<string, InventoryStatus> }> {
  const errors: string[] = [];
  const inventoryChecks: Record<string, InventoryStatus> = {};

  const checksToRun: Array<{ item: string; needed: boolean; errorMessage: string }> = [
    {
      item: INVENTORY_ITEMS.ELECTRIC_BIKE,
      needed: bikeRental === 'electric' || !!addons.electric_upgrade,
      errorMessage: 'Electric bikes are fully booked for this date. Please choose a standard bike or select a different date.',
    },
    {
      item: INVENTORY_ITEMS.GOPRO,
      needed: !!addons.gopro,
      errorMessage: 'GoPro cameras are fully booked for this date. Please select a different date.',
    },
    {
      item: INVENTORY_ITEMS.STANDARD_BIKE,
      needed: bikeRental === 'standard' || bikeRental === 'electric',
      errorMessage: 'Bikes are fully booked for this date. Please select a different date or choose "No bike rental".',
    },
  ];

  await Promise.all(
    checksToRun.map(async ({ item, needed, errorMessage }) => {
      if (!needed) return;
      const status = await checkItemAvailability(item, date);
      inventoryChecks[item] = status;
      if (status.available <= 0) {
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
