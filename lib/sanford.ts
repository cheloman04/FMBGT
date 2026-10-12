// Sanford paved tour rules (agreed with Dustin, Oct 2026).
//
// - Priced per GROUP: each booking is one group and pays by its size
//   (PRICING.SANFORD_GROUP in lib/pricing.ts), plus tax and any e-bike upgrades.
// - Shared departures: several groups can book the same tour. One departure a
//   day at 10:00 AM, up to 7 riders across all its groups.
// - 2 hours, bike included.
//
// Client-safe (no database access) — seat counting lives in lib/sanford-departures.ts.

import { normalizeLocationName } from '@/lib/location-status';
import { easternLocalToUtcIso } from '@/lib/booking-datetime';
import type { AvailabilitySlot } from '@/types/booking';

export const SANFORD_LOCATION_NAME = 'Sanford Historic Riverfront Tour';

/** The day's only departure, Eastern time ("HH:MM", same format as bookings.time_slot). */
export const SANFORD_DEPARTURE_TIME = '10:00';

/** Riders per departure, all groups combined — also the largest single group. */
export const SANFORD_MAX_RIDERS = 7;

/** E-bikes in the fleet; every other rider gets a standard bike. */
export const SANFORD_MAX_EBIKES = 2;

/**
 * Same minimum notice as the Sanford event type in Cal.com (1200 minutes): Cal
 * applies it to new departures, this applies it to groups joining one.
 */
export const SANFORD_MIN_NOTICE_HOURS = 20;

const SANFORD_KEY = normalizeLocationName(SANFORD_LOCATION_NAME);

export function isSanfordLocation(name: string | null | undefined): boolean {
  return Boolean(name) && normalizeLocationName(name as string) === SANFORD_KEY;
}

/**
 * Bookable Sanford departures for a group of `riders`.
 *
 * Cal.com only offers a departure nobody has booked yet (the event type allows
 * one booking a day), so a day that already has groups is added back from our
 * own records while seats remain. `ridersBooked` is keyed by date, for the
 * 10:00 departure only.
 */
export function buildSanfordSlots(input: {
  calSlots: AvailabilitySlot[];
  ridersBooked: Map<string, number>;
  riders: number;
  dateFrom: string;
  dateTo: string;
  now?: Date;
}): AvailabilitySlot[] {
  const now = input.now ?? new Date();
  const earliestStart = now.getTime() + SANFORD_MIN_NOTICE_HOURS * 3_600_000;
  const slots = new Map<string, AvailabilitySlot>();

  const slotFor = (date: string): AvailabilitySlot => {
    const seatsLeft = Math.max(0, SANFORD_MAX_RIDERS - (input.ridersBooked.get(date) ?? 0));
    return {
      date,
      time: SANFORD_DEPARTURE_TIME,
      available: seatsLeft >= input.riders,
      seats_left: seatsLeft,
    };
  };

  for (const slot of input.calSlots) {
    if (slot.time === SANFORD_DEPARTURE_TIME && slot.available) slots.set(slot.date, slotFor(slot.date));
  }

  for (const date of input.ridersBooked.keys()) {
    if (slots.has(date) || date < input.dateFrom || date > input.dateTo) continue;
    if (Date.parse(easternLocalToUtcIso(date, SANFORD_DEPARTURE_TIME)) < earliestStart) continue;
    slots.set(date, slotFor(date));
  }

  return [...slots.values()].sort((a, b) => a.date.localeCompare(b.date));
}
