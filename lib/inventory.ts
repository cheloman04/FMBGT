import type { Addons, BikeRental, BookingStatus, InventoryStatus } from '@/types/booking';
import { bookingBikeCounts, type BikeCountRow, type BikeCounts } from './bike-counts';
import { getSupabaseAdmin } from './supabase';

export const INVENTORY_ITEMS = {
  ELECTRIC_BIKE: 'electric_bike',
  GOPRO: 'gopro',
  STANDARD_BIKE: 'standard_bike',
} as const;

// Bookings that hold rental inventory on their date
const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'confirmed'];

async function sumBikesOnDate(date: string, excludeBookingId?: string): Promise<BikeCounts> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('bookings')
    .select('bike_rental, participant_info, addons')
    .eq('date', date)
    .in('status', ACTIVE_STATUSES);
  if (excludeBookingId) query = query.neq('id', excludeBookingId);

  const { data, error } = await query;
  if (error) throw error;

  const used: BikeCounts = { bikes: 0, electric: 0 };
  for (const row of (data ?? []) as BikeCountRow[]) {
    const counts = bookingBikeCounts(row);
    used.bikes += counts.bikes;
    used.electric += counts.electric;
  }
  return used;
}

// Count how many units of an item are reserved on a given date
async function countReservedOnDate(item: string, date: string, excludeBookingId?: string): Promise<number> {
  if (item === INVENTORY_ITEMS.ELECTRIC_BIKE) return (await sumBikesOnDate(date, excludeBookingId)).electric;
  if (item === INVENTORY_ITEMS.STANDARD_BIKE) return (await sumBikesOnDate(date, excludeBookingId)).bikes;

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('bookings')
    .select('id', { count: 'exact' })
    .eq('date', date)
    .in('status', ACTIVE_STATUSES)
    .contains('addons', { gopro: true });
  if (excludeBookingId) query = query.neq('id', excludeBookingId);

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
  date: string,
  excludeBookingId?: string
): Promise<InventoryStatus> {
  const [total, reserved] = await Promise.all([
    getTotalInventory(item),
    countReservedOnDate(item, date, excludeBookingId),
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
  additionalParticipants?: Array<{ bike_rental?: string }>,
  options: { excludeBookingId?: string } = {}
): Promise<{ valid: boolean; errors: string[]; inventory: Record<string, InventoryStatus> }> {
  const errors: string[] = [];
  const inventoryChecks: Record<string, InventoryStatus> = {};

  const needed = bookingBikeCounts({
    bike_rental: bikeRental,
    participant_info: additionalParticipants ?? [],
    addons,
  });

  const checksToRun: Array<{ item: string; needed: boolean; count: number; errorMessage: string }> = [
    {
      item: INVENTORY_ITEMS.ELECTRIC_BIKE,
      needed: needed.electric > 0,
      count: needed.electric,
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
      needed: needed.bikes > 0,
      count: needed.bikes,
      errorMessage: 'Bikes are fully booked for this date. Please select a different date or choose "No bike rental".',
    },
  ];

  await Promise.all(
    checksToRun.map(async ({ item, needed, count, errorMessage }) => {
      if (!needed) return;
      const status = await checkItemAvailability(item, date, options.excludeBookingId);
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

/**
 * The rental fleet and how much of it each date in [dateFrom, dateTo] already
 * uses — lets the booking calendar grey out dates before the rider reaches
 * checkout (pair with lacksBikes).
 */
export async function getFleetUsage(
  dateFrom: string,
  dateTo: string
): Promise<{ totals: BikeCounts; usedByDate: Map<string, BikeCounts> }> {
  const supabase = getSupabaseAdmin();
  const [{ data: inventory, error: inventoryError }, { data: bookings, error: bookingsError }] = await Promise.all([
    supabase
      .from('inventory')
      .select('item, quantity')
      .in('item', [INVENTORY_ITEMS.STANDARD_BIKE, INVENTORY_ITEMS.ELECTRIC_BIKE]),
    supabase
      .from('bookings')
      .select('date, bike_rental, participant_info, addons')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .in('status', ACTIVE_STATUSES),
  ]);
  if (inventoryError) throw inventoryError;
  if (bookingsError) throw bookingsError;

  const quantity = (item: string) =>
    ((inventory ?? []) as Array<{ item: string; quantity: number }>).find((row) => row.item === item)?.quantity ?? 0;
  const totals: BikeCounts = {
    bikes: quantity(INVENTORY_ITEMS.STANDARD_BIKE),
    electric: quantity(INVENTORY_ITEMS.ELECTRIC_BIKE),
  };

  const usedByDate = new Map<string, BikeCounts>();
  for (const row of (bookings ?? []) as Array<BikeCountRow & { date: string }>) {
    const used = usedByDate.get(row.date) ?? { bikes: 0, electric: 0 };
    const counts = bookingBikeCounts(row);
    usedByDate.set(row.date, { bikes: used.bikes + counts.bikes, electric: used.electric + counts.electric });
  }
  return { totals, usedByDate };
}

// Check if electric bike option should be shown as available
export async function isElectricBikeAvailable(date: string): Promise<boolean> {
  if (!date) return true; // Show as available before date is selected
  const status = await checkItemAvailability(INVENTORY_ITEMS.ELECTRIC_BIKE, date);
  return status.available > 0;
}
