// Admin edit of an ONLINE (Stripe) booking, from /admin/bookings/[id]. Manual
// bookings keep their own edit (updateManualBooking in lib/manual-booking.ts).
//
// One function computes the preview (dryRun: nothing is written) and applies the
// save, so what the admin reviews is exactly what gets saved. A save keeps every
// party in step: price (lib/booking-quote.ts) and the automatic balance charge
// (lib/booking-money.ts), rental inventory, the Cal.com event, the waiver, Fin
// Log, Senzai and — when asked — a "Your booking was updated" email.

import 'server-only';

import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateBookingInventory } from '@/lib/inventory';
import { isLocationComingSoon, COMING_SOON_MESSAGE } from '@/lib/location-status';
import { overrideQuote, quoteBooking, quoteToBookingPatch } from '@/lib/booking-quote';
import { addonsNotOfferedOn } from '@/lib/pricing';
import {
  bookingTotalCents,
  formatUsd,
  remainingBalanceDueAt,
  rescheduleBalance,
  scheduledChargeCents,
  unsettledCents,
  type BookingMoneyRow,
} from '@/lib/booking-money';
import {
  recreateBookingCalendarEvent,
  syncBookingCalendarEvent,
  type CalendarSyncResult,
} from '@/lib/booking-calendar';
import { recordFinancialEvent } from '@/lib/financial-log';
import { queueSenzaiEvent } from '@/lib/analytics-delivery';
import { sendBookingUpdatedEmail, type UpdateEmailResult } from '@/lib/booking-update-email';
import { formatFloridaCalendarDate, formatTourTime } from '@/lib/display-time';
import type { Addons, BikeRental, SkillLevel, TrailType } from '@/types/booking';

const SOURCE = '/api/admin/bookings';

// Same limits as checkout (app/api/create-checkout/route.ts). The admin can go
// past them — they come back as warnings; rental inventory is the hard limit.
const MAX_RIDERS_MTB = 6;
const MAX_RIDERS_PAVED: Record<string, number> = { 'Sanford Historic Riverfront Tour': 6 };
const MAX_STANDARD_PER_BOOKING = 4;
const MAX_ELECTRIC_PER_BOOKING = 2;

export type RiderInput = { name: string; bike_rental?: BikeRental; height_inches?: number | null };

export type OnlineBookingEdit = {
  id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string | null;
  date?: string;
  time_slot?: string;
  duration_hours?: number;
  location_id?: string;
  skill_level?: SkillLevel | null;
  bike_rental?: BikeRental;
  rider_height_inches?: number | null;
  /** Riders 2..N — the full list replaces the old one. */
  participants?: RiderInput[];
  addons?: { gopro?: boolean; pickup_dropoff?: boolean };
  admin_notes?: string | null;
  /** The admin's own final price, instead of the recalculated one. */
  price_override_cents?: number | null;
  price_override_reason?: string | null;
  notify_customer?: boolean;
};

export type EditChange = {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
  /** Not shown to the customer. */
  internal?: boolean;
};

export type EditPreview = {
  changes: EditChange[];
  price: { from: number; to: number; quoted: number; overridden: boolean } | null;
  balance: {
    scheduled_from: number;
    scheduled_to: number;
    /** When the saved card gets charged the scheduled amount. */
    due_at: string | null;
    /** + still owed by the customer, − owed back to the customer. */
    unsettled: number;
  };
  calendar: 'reschedule' | 'recreate' | null;
  /** Riders the waiver doesn't cover yet. */
  waiver_needs: string[];
  warnings: string[];
};

export type EditResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      dryRun: boolean;
      preview: EditPreview;
      calendar: CalendarSyncResult | null;
      email: UpdateEmailResult | null;
    };

type StoredRider = { name?: string; bike_rental?: BikeRental; height_inches?: number | null };

type BookingRow = BookingMoneyRow & {
  id: string;
  status: string;
  customer_id: string | null;
  lead_id: string | null;
  location_id: string | null;
  trail_type: TrailType;
  skill_level: SkillLevel | null;
  date: string;
  time_slot: string;
  duration_hours: number;
  bike_rental: BikeRental;
  rider_height_inches: number | null;
  addons: Addons | null;
  participant_info: StoredRider[] | null;
  discount_code: string | null;
  discount_percentage: number | null;
  discount_amount_cents: number | null;
  gift_card_id: string | null;
  remaining_balance_due_at: string | null;
  remaining_balance_payment_intent_id: string | null;
  waiver_accepted: boolean | null;
  waiver_session_id: string | null;
  waiver_link_token: string | null;
  admin_notes: string | null;
  customers: { name?: string; email?: string; phone?: string | null } | null;
  locations: { name?: string } | null;
};

export const EDIT_BOOKING_COLUMNS =
  'id, status, booking_source, customer_id, lead_id, location_id, trail_type, skill_level, date, time_slot, ' +
  'duration_hours, bike_rental, rider_height_inches, addons, participant_info, total_price, ' +
  'total_after_discount_cents, discount_code, discount_percentage, discount_amount_cents, gift_card_id, ' +
  'deposit_paid_cents, deposit_payment_status, remaining_balance_amount, remaining_balance_status, ' +
  'remaining_balance_due_at, remaining_balance_payment_intent_id, stripe_payment_method_id, extra_paid_cents, ' +
  'refunded_cents, waiver_accepted, waiver_session_id, waiver_link_token, admin_notes, ' +
  'customers(name, email, phone), locations(name)';

function bikeLabel(bike: BikeRental | undefined): string {
  if (bike === 'electric') return 'e-bike';
  if (bike === 'standard') return 'rental bike';
  return 'own bike';
}

function describeRiders(riders: StoredRider[]): string | null {
  if (riders.length === 0) return null;
  return riders
    .map((r) => `${r.name ?? 'Rider'} (${bikeLabel(r.bike_rental)}${r.height_inches ? `, ${r.height_inches}"` : ''})`)
    .join(', ');
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

const fmtDate = (date: string) => formatFloridaCalendarDate(date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** One line per customer-facing change, for the update email. */
export function customerChangeSummary(changes: EditChange[]): string[] {
  return changes.filter((c) => !c.internal).map((c) => `${c.label}: ${c.from ?? '—'} → ${c.to ?? '—'}`);
}

export async function editOnlineBooking(
  input: OnlineBookingEdit,
  opts: { dryRun: boolean; adminEmail: string | null }
): Promise<EditResult> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bookings')
    .select(EDIT_BOOKING_COLUMNS)
    .eq('id', input.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) return { ok: false, status: 404, error: 'Booking not found' };

  const booking = data as BookingRow;
  if (booking.booking_source === 'manual') {
    return { ok: false, status: 400, error: 'Manual bookings are edited with the manual booking tools.' };
  }
  if (booking.status !== 'confirmed') {
    return { ok: false, status: 409, error: `A ${booking.status} booking can't be edited.` };
  }

  const isPaved = booking.trail_type === 'paved';
  const customer = booking.customers;
  const changes: EditChange[] = [];
  const warnings: string[] = [];
  const customerPatch: Record<string, unknown> = {};
  const bookingPatch: Record<string, unknown> = {};

  // ── Contact (the customer record is shared by all their bookings) ─────────────
  const newName = input.customer_name?.trim();
  if (newName !== undefined && newName !== (customer?.name ?? '')) {
    if (!newName) return { ok: false, status: 400, error: 'The customer needs a name.' };
    changes.push({ field: 'customer_name', label: 'Name', from: customer?.name ?? null, to: newName });
    customerPatch.name = newName;
  }
  const newEmail = input.customer_email?.trim().toLowerCase();
  if (newEmail !== undefined && newEmail !== (customer?.email ?? '').toLowerCase()) {
    changes.push({ field: 'customer_email', label: 'Email', from: customer?.email ?? null, to: newEmail, internal: true });
    customerPatch.email = newEmail;
  }
  if (input.customer_phone !== undefined) {
    const newPhone = input.customer_phone?.trim() || null;
    if (newPhone !== (customer?.phone ?? null)) {
      changes.push({ field: 'customer_phone', label: 'Phone', from: customer?.phone ?? null, to: newPhone, internal: true });
      customerPatch.phone = newPhone;
    }
  }

  // ── Schedule ──────────────────────────────────────────────────────────────────
  const newDate = input.date ?? booking.date;
  const newTime = input.time_slot ?? booking.time_slot;
  const newDuration = input.duration_hours ?? booking.duration_hours;
  if (isPaved && newDuration !== 2) return { ok: false, status: 400, error: 'Paved tours are always 2 hours.' };
  if (newDate !== booking.date) {
    changes.push({ field: 'date', label: 'Date', from: fmtDate(booking.date), to: fmtDate(newDate) });
    bookingPatch.date = newDate;
  }
  if (newTime !== booking.time_slot) {
    changes.push({ field: 'time_slot', label: 'Time', from: formatTourTime(booking.time_slot), to: formatTourTime(newTime) });
    bookingPatch.time_slot = newTime;
  }
  if (newDuration !== booking.duration_hours) {
    changes.push({ field: 'duration_hours', label: 'Duration', from: `${booking.duration_hours} h`, to: `${newDuration} h` });
    bookingPatch.duration_hours = newDuration;
  }

  // ── Location / skill level ────────────────────────────────────────────────────
  let locationName = booking.locations?.name ?? null;
  if (input.location_id && input.location_id !== booking.location_id) {
    const { data: location } = await supabase
      .from('locations')
      .select('id, name, tour_type, active')
      .eq('id', input.location_id)
      .maybeSingle();
    const loc = location as { id: string; name: string; tour_type: TrailType; active: boolean } | null;
    if (!loc || !loc.active) return { ok: false, status: 400, error: 'Location not found.' };
    if (loc.tour_type !== booking.trail_type) {
      return {
        ok: false,
        status: 400,
        error: "A tour can't switch between mountain bike and paved — cancel it and create a new booking.",
      };
    }
    if (isLocationComingSoon(loc.name)) return { ok: false, status: 400, error: COMING_SOON_MESSAGE };
    changes.push({ field: 'location', label: 'Location', from: locationName, to: loc.name });
    bookingPatch.location_id = loc.id;
    locationName = loc.name;
  }
  if (input.skill_level !== undefined && input.skill_level !== booking.skill_level) {
    changes.push({ field: 'skill_level', label: 'Skill level', from: booking.skill_level, to: input.skill_level, internal: true });
    bookingPatch.skill_level = input.skill_level;
  }

  // ── Riders and bikes ──────────────────────────────────────────────────────────
  const newLeadBike: BikeRental = input.bike_rental ?? booking.bike_rental;
  if (isPaved && newLeadBike === 'none') {
    return { ok: false, status: 400, error: 'Paved tours include a bike for every rider.' };
  }
  const toRider = (r: StoredRider): StoredRider => ({
    name: (r.name ?? '').trim(),
    bike_rental: r.bike_rental ?? (isPaved ? 'standard' : 'none'),
    height_inches: r.height_inches ?? null,
  });
  const oldRiders: StoredRider[] = (Array.isArray(booking.participant_info) ? booking.participant_info : []).map(toRider);
  const newRiders: StoredRider[] = input.participants === undefined ? oldRiders : input.participants.map(toRider);
  if (newRiders.some((r) => !r.name)) return { ok: false, status: 400, error: 'Every rider needs a name.' };
  if (isPaved && newRiders.some((r) => r.bike_rental === 'none')) {
    return { ok: false, status: 400, error: 'Paved tours include a bike for every rider.' };
  }

  const leadBikeChanged = newLeadBike !== booking.bike_rental;
  if (leadBikeChanged) {
    changes.push({ field: 'bike_rental', label: 'Lead rider bike', from: bikeLabel(booking.bike_rental), to: bikeLabel(newLeadBike) });
    bookingPatch.bike_rental = newLeadBike;
  }
  if (input.rider_height_inches !== undefined && (input.rider_height_inches ?? null) !== booking.rider_height_inches) {
    changes.push({
      field: 'rider_height_inches',
      label: 'Lead rider height',
      from: booking.rider_height_inches ? `${booking.rider_height_inches}"` : null,
      to: input.rider_height_inches ? `${input.rider_height_inches}"` : null,
      internal: true,
    });
    bookingPatch.rider_height_inches = input.rider_height_inches ?? null;
  }
  const ridersChanged = JSON.stringify(newRiders) !== JSON.stringify(oldRiders);
  if (ridersChanged) {
    changes.push({ field: 'riders', label: 'Other riders', from: describeRiders(oldRiders), to: describeRiders(newRiders) });
    bookingPatch.participant_info = newRiders.length > 0 ? newRiders : null;
    bookingPatch.participant_count = 1 + newRiders.length;
  }

  const riderCount = 1 + newRiders.length;
  const maxRiders = isPaved ? MAX_RIDERS_PAVED[locationName ?? ''] ?? 4 : MAX_RIDERS_MTB;
  if (riderCount > maxRiders) warnings.push(`${riderCount} riders is more than the ${maxRiders} allowed online at this location.`);
  const allBikes = [newLeadBike, ...newRiders.map((r) => r.bike_rental)];
  if (allBikes.filter((b) => b === 'standard').length > MAX_STANDARD_PER_BOOKING) {
    warnings.push(`More than ${MAX_STANDARD_PER_BOOKING} standard rental bikes on one booking (online limit).`);
  }
  if (allBikes.filter((b) => b === 'electric').length > MAX_ELECTRIC_PER_BOOKING) {
    warnings.push(`More than ${MAX_ELECTRIC_PER_BOOKING} e-bikes on one booking (online limit).`);
  }

  // ── Add-ons (mountain bike) ───────────────────────────────────────────────────
  const oldAddons: Addons = booking.addons ?? {};
  const newAddons: Addons = { ...oldAddons };
  if (addonsNotOfferedOn(booking.trail_type, input.addons).length > 0) {
    return { ok: false, status: 400, error: 'GoPro and pickup are only available on mountain bike tours.' };
  }
  if (input.addons) {
    for (const key of ['gopro', 'pickup_dropoff'] as const) {
      const next = input.addons[key];
      if (next !== undefined && Boolean(next) !== Boolean(oldAddons[key])) {
        newAddons[key] = next;
        changes.push({
          field: `addon_${key}`,
          label: key === 'gopro' ? 'GoPro package' : 'Pickup + dropoff',
          from: oldAddons[key] ? 'yes' : 'no',
          to: next ? 'yes' : 'no',
        });
      }
    }
    if (JSON.stringify(newAddons) !== JSON.stringify(oldAddons)) bookingPatch.addons = newAddons;
  }

  // ── Notes ─────────────────────────────────────────────────────────────────────
  if (input.admin_notes !== undefined) {
    const notes = input.admin_notes?.trim() || null;
    if (notes !== (booking.admin_notes ?? null)) {
      changes.push({ field: 'admin_notes', label: 'Notes', from: booking.admin_notes ?? null, to: notes, internal: true });
      bookingPatch.admin_notes = notes;
    }
  }

  // ── Rental inventory (the DB trigger only checks new bookings) ────────────────
  const bikesChanged = leadBikeChanged || ridersChanged || bookingPatch.addons !== undefined;
  if (bookingPatch.date || bikesChanged) {
    const inventory = await validateBookingInventory(newDate, newLeadBike, newAddons, newRiders, {
      excludeBookingId: booking.id,
    });
    if (!inventory.valid) return { ok: false, status: 409, error: inventory.errors[0] ?? 'No rental inventory for that date.' };
  }

  // ── Price — only re-quoted when something that sets it changed ────────────────
  const priceRelevant = bikesChanged || bookingPatch.duration_hours !== undefined || bookingPatch.location_id !== undefined;
  const overrideCents = input.price_override_cents ?? null;
  const currentTotal = bookingTotalCents(booking);
  let price: EditPreview['price'] = null;
  let pricePatch: Record<string, number | null> = {};
  if (priceRelevant || overrideCents !== null) {
    const hasCode = Boolean(booking.discount_code || booking.gift_card_id);
    const quote = quoteBooking({
      trail_type: booking.trail_type,
      location_name: locationName,
      bike_rental: newLeadBike,
      duration_hours: newDuration,
      addons: newAddons,
      participants: newRiders.map((r) => ({ name: r.name ?? '', bike_rental: r.bike_rental, height_inches: r.height_inches ?? undefined })),
      discount_percentage: booking.gift_card_id ? null : booking.discount_percentage,
      gift_card_applied_cents: booking.gift_card_id ? booking.discount_amount_cents ?? 0 : null,
    });
    let finalQuote = quote;
    if (overrideCents !== null) {
      if (!input.price_override_reason?.trim()) return { ok: false, status: 400, error: 'Add a reason for the custom price.' };
      finalQuote = overrideQuote(quote, overrideCents, hasCode);
    }
    if (finalQuote.total_after_discount_cents !== currentTotal) {
      price = {
        from: currentTotal,
        to: finalQuote.total_after_discount_cents,
        quoted: quote.total_after_discount_cents,
        overridden: finalQuote.overridden,
      };
      pricePatch = quoteToBookingPatch(finalQuote, hasCode);
      changes.push({ field: 'total', label: 'Price', from: formatUsd(currentTotal), to: formatUsd(price.to) });
      if (finalQuote.overridden) {
        changes.push({
          field: 'price_override_reason',
          label: 'Custom price reason',
          from: null,
          to: input.price_override_reason?.trim() ?? null,
          internal: true,
        });
      }
    }
  }

  // ── Money: the automatic balance charge absorbs a price change ────────────────
  if (price) {
    if (booking.remaining_balance_payment_intent_id === 'processing') {
      return { ok: false, status: 409, error: 'The balance is being charged right now — try again in a few minutes.' };
    }
    const balance = rescheduleBalance(booking, price.to);
    if (balance) Object.assign(bookingPatch, balance);
  }
  const after = { ...booking, ...pricePatch, ...bookingPatch } as BookingRow;
  // The charge date follows the tour (the day before).
  if (scheduledChargeCents(after) > 0 && (bookingPatch.date || !booking.remaining_balance_due_at)) {
    bookingPatch.remaining_balance_due_at = remainingBalanceDueAt(newDate);
    after.remaining_balance_due_at = bookingPatch.remaining_balance_due_at as string;
  }

  // ── Waiver: riders nobody has signed for need to sign ─────────────────────────
  const beforeNames = new Set([customer?.name ?? '', ...oldRiders.map((r) => r.name ?? '')].map(normalizeName));
  const candidates = [newName ?? customer?.name ?? '', ...newRiders.map((r) => r.name ?? '')].filter(
    (name) => name && !beforeNames.has(normalizeName(name))
  );
  let waiverNeeds: string[] = [];
  if (candidates.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let waiverQuery = (supabase as any).from('waiver_records').select('participants_covered');
    waiverQuery = booking.waiver_session_id
      ? waiverQuery.or(`booking_id.eq.${booking.id},session_id.eq.${booking.waiver_session_id}`)
      : waiverQuery.eq('booking_id', booking.id);
    const { data: records } = await waiverQuery;
    const covered = new Set(
      ((records ?? []) as Array<{ participants_covered: string[] | null }>)
        .flatMap((r) => r.participants_covered ?? [])
        .map(normalizeName)
    );
    waiverNeeds = candidates.filter((name) => !covered.has(normalizeName(name)));
  }
  if (waiverNeeds.length > 0) {
    bookingPatch.waiver_accepted = false;
    if (!booking.waiver_link_token) bookingPatch.waiver_link_token = randomUUID();
    if (!booking.waiver_session_id) bookingPatch.waiver_session_id = randomUUID();
    changes.push({ field: 'waiver', label: 'Waiver', from: 'signed', to: `needs signature: ${waiverNeeds.join(', ')}`, internal: true });
  }

  const scheduleChanged = Boolean(bookingPatch.date || bookingPatch.time_slot || bookingPatch.duration_hours);
  const preview: EditPreview = {
    changes,
    price,
    balance: {
      scheduled_from: scheduledChargeCents(booking),
      scheduled_to: scheduledChargeCents(after),
      due_at: scheduledChargeCents(after) > 0 ? after.remaining_balance_due_at : null,
      unsettled: unsettledCents(after),
    },
    calendar: bookingPatch.location_id ? 'recreate' : scheduleChanged ? 'reschedule' : null,
    waiver_needs: waiverNeeds,
    warnings,
  };

  if (opts.dryRun || changes.length === 0) {
    return { ok: true, dryRun: opts.dryRun, preview, calendar: null, email: null };
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  if (Object.keys(customerPatch).length > 0) {
    if (!booking.customer_id) return { ok: false, status: 409, error: 'This booking has no customer record.' };
    const { error: customerError } = await supabase.from('customers').update(customerPatch).eq('id', booking.customer_id);
    if (customerError) {
      if (customerError.code === '23505') return { ok: false, status: 409, error: 'That email already belongs to another customer.' };
      console.error('[booking-edit] customer update failed:', customerError.message);
      return { ok: false, status: 500, error: 'Failed to update the customer' };
    }
  }

  const fullPatch = { ...pricePatch, ...bookingPatch };
  if (Object.keys(fullPatch).length > 0) {
    // Never while the cron is charging the balance (it already read the amount).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: saved, error: bookingError } = await (supabase as any)
      .from('bookings')
      .update(fullPatch)
      .eq('id', booking.id)
      .eq('status', 'confirmed')
      .or('remaining_balance_payment_intent_id.is.null,remaining_balance_payment_intent_id.neq.processing')
      .select('id');
    if (bookingError) {
      console.error('[booking-edit] booking update failed:', bookingError.message);
      return { ok: false, status: 500, error: 'Failed to update the booking' };
    }
    if (!saved || saved.length === 0) {
      return { ok: false, status: 409, error: 'This booking changed while saving — refresh and try again.' };
    }
  }

  // Calendar: a new location needs a new event; a new time moves the existing one.
  let calendar: CalendarSyncResult | null = null;
  if (preview.calendar === 'recreate') {
    calendar = await recreateBookingCalendarEvent(booking.id, { source: SOURCE, reason: 'Tour moved to another location' });
  } else if (preview.calendar === 'reschedule') {
    calendar = await syncBookingCalendarEvent(booking.id, { source: SOURCE, reason: 'Tour details updated' });
  }

  const occurredAt = new Date().toISOString();
  try {
    await recordFinancialEvent({
      event_name: 'booking.edited',
      event_category: 'booking',
      severity: 'info',
      entity_type: 'booking',
      entity_id: booking.id,
      booking_id: booking.id,
      lead_id: booking.lead_id,
      amount: price ? price.to : null,
      currency: 'usd',
      status: 'edited',
      message:
        `Booking edited by ${opts.adminEmail ?? 'admin'}: ${changes.map((c) => c.label).join(', ')}` +
        (price ? ` — price ${formatUsd(price.from)} → ${formatUsd(price.to)}` : ''),
      metadata: {
        edited_by: opts.adminEmail,
        changes: changes.map((c) => ({ field: c.field, label: c.label, from: c.from, to: c.to })),
        price_from: price?.from ?? null,
        price_to: price?.to ?? null,
        price_quoted: price?.quoted ?? null,
        price_overridden: price?.overridden ?? false,
        scheduled_charge_from: preview.balance.scheduled_from,
        scheduled_charge_to: preview.balance.scheduled_to,
        unsettled: preview.balance.unsettled,
      },
      occurred_at: occurredAt,
    });
  } catch (e) {
    console.error('[booking-edit] financial log failed:', (e as Error).message);
  }

  // Senzai — a new date/time/duration/location is a reschedule (contract catalog).
  if (scheduleChanged || bookingPatch.location_id) {
    try {
      await queueSenzaiEvent({
        event_name: 'booking.rescheduled',
        occurred_at: occurredAt,
        source_event_id: `${booking.id}:${occurredAt}`,
        idempotency_key: `booking:${booking.id}:booking.rescheduled:${occurredAt}`,
        source_route: SOURCE,
        authoritative_source: 'supabase.bookings.admin_edit',
        entity_type: 'booking',
        entity_id: booking.id,
        refs: { booking_id: booking.id, lead_id: booking.lead_id, customer_id: booking.customer_id },
        data: {
          booking_id: booking.id,
          previous_date: booking.date,
          date: newDate,
          previous_time: booking.time_slot,
          time: newTime,
          previous_duration_hours: booking.duration_hours,
          duration_hours: newDuration,
          previous_location_name: booking.locations?.name ?? null,
          location_name: locationName,
          rescheduled_by: opts.adminEmail,
        },
      });
    } catch (e) {
      console.error('[booking-edit] Senzai booking.rescheduled failed:', (e as Error).message);
    }
  }

  const summary = customerChangeSummary(changes);
  const email =
    input.notify_customer && summary.length > 0
      ? await sendBookingUpdatedEmail(booking.id, { changesSummary: summary, source: SOURCE })
      : null;

  console.log(`[booking-edit] ${booking.id} edited by ${opts.adminEmail ?? 'admin'}: ${changes.map((c) => c.field).join(', ')}`);
  return { ok: true, dryRun: false, preview, calendar, email };
}
