// Money on a booking, for edits and the admin's payment actions. Pure — safe to
// import from client components.
//
// Online bookings: 50% deposit at checkout + the remaining balance charged to the
// saved card the day before the tour (cron charge-remaining). After an edit, the
// admin can collect more (extra_paid_cents) or refund (refunded_cents) — see
// supabase/migrations/034_booking_payment_adjustments.sql.
//
// Manual bookings: deposit_paid_cents is everything collected off-platform and
// remaining_balance_amount is what's still owed (lib/manual-booking.ts).

/** Stripe won't charge less than this. */
export const STRIPE_MIN_CHARGE_CENTS = 50;

export type BookingMoneyRow = {
  booking_source?: string | null;
  total_price: number | null;
  total_after_discount_cents?: number | null;
  deposit_paid_cents?: number | null;
  deposit_payment_status?: string | null;
  remaining_balance_amount?: number | null;
  remaining_balance_status?: string | null;
  extra_paid_cents?: number | null;
  refunded_cents?: number | null;
  stripe_payment_method_id?: string | null;
};

const isManual = (row: BookingMoneyRow) => row.booking_source === 'manual';

/** What the customer pays in total, after any discount or gift card. */
export function bookingTotalCents(row: BookingMoneyRow): number {
  return row.total_after_discount_cents ?? row.total_price ?? 0;
}

/** Collected so far, net of refunds. */
export function netCollectedCents(row: BookingMoneyRow): number {
  const deposit = isManual(row) || row.deposit_payment_status === 'paid' ? row.deposit_paid_cents ?? 0 : 0;
  const balance = !isManual(row) && row.remaining_balance_status === 'paid' ? row.remaining_balance_amount ?? 0 : 0;
  return deposit + balance + (row.extra_paid_cents ?? 0) - (row.refunded_cents ?? 0);
}

/** Balance the saved card will still be charged for (online, not yet collected). */
export function scheduledChargeCents(row: BookingMoneyRow): number {
  if (isManual(row) || !row.stripe_payment_method_id) return 0;
  const status = row.remaining_balance_status;
  return status === 'pending' || status === 'failed' ? row.remaining_balance_amount ?? 0 : 0;
}

/**
 * Left to settle by hand: positive = the customer still owes it (nothing will
 * charge it automatically), negative = a refund is owed to the customer.
 */
export function unsettledCents(row: BookingMoneyRow): number {
  return bookingTotalCents(row) - netCollectedCents(row) - scheduledChargeCents(row);
}

export type RescheduledBalance = {
  remaining_balance_amount: number;
  remaining_balance_status: 'pending' | 'failed' | 'waived';
};

/**
 * When the total of an online booking changes before its balance is charged,
 * the automatic charge absorbs the difference. Under Stripe's minimum the
 * balance is waived; if the customer has already paid more than the new total,
 * the balance is waived and the excess shows up as a refund owed
 * (unsettledCents < 0). Returns null when there is no automatic charge to adjust
 * (manual booking, no saved card, or the balance was already charged).
 */
export function rescheduleBalance(row: BookingMoneyRow, newTotalCents: number): RescheduledBalance | null {
  if (isManual(row) || !row.stripe_payment_method_id) return null;
  const status = row.remaining_balance_status;
  if (status !== 'pending' && status !== 'failed' && status !== 'waived') return null;

  const owed = newTotalCents - netCollectedCents(row);
  if (owed >= STRIPE_MIN_CHARGE_CENTS) {
    return { remaining_balance_amount: owed, remaining_balance_status: status === 'failed' ? 'failed' : 'pending' };
  }
  return { remaining_balance_amount: 0, remaining_balance_status: 'waived' };
}

/**
 * When the cron charges the balance: the start of the UTC day before the tour,
 * so the daily run always picks it up on the day before. Mirrors
 * calcRemainingBalanceDueAt in app/api/create-checkout/route.ts.
 */
export function remainingBalanceDueAt(tourDate: string): string {
  const [y, m, d] = tourDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d - 1, 0, 0, 0)).toISOString();
}

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
