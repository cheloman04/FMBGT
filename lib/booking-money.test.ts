import { describe, expect, it } from 'vitest';
import {
  bookingTotalCents,
  netCollectedCents,
  remainingBalanceDueAt,
  rescheduleBalance,
  scheduledChargeCents,
  unsettledCents,
  type BookingMoneyRow,
} from './booking-money';

// $400 tour: $200 deposit paid at checkout, $200 to charge the day before.
const online = (overrides: Partial<BookingMoneyRow> = {}): BookingMoneyRow => ({
  booking_source: 'online',
  total_price: 40000,
  deposit_paid_cents: 20000,
  deposit_payment_status: 'paid',
  remaining_balance_amount: 20000,
  remaining_balance_status: 'pending',
  extra_paid_cents: 0,
  refunded_cents: 0,
  stripe_payment_method_id: 'pm_123',
  ...overrides,
});

describe('booking money', () => {
  it('a fresh online booking has its balance scheduled and nothing to settle', () => {
    const row = online();
    expect(netCollectedCents(row)).toBe(20000);
    expect(scheduledChargeCents(row)).toBe(20000);
    expect(unsettledCents(row)).toBe(0);
  });

  it('uses the discounted total when there is a code', () => {
    expect(bookingTotalCents(online({ total_after_discount_cents: 32000 }))).toBe(32000);
  });

  it('counts the charged balance, extras and refunds', () => {
    const row = online({ remaining_balance_status: 'paid', extra_paid_cents: 5000, refunded_cents: 3000 });
    expect(netCollectedCents(row)).toBe(42000);
    expect(scheduledChargeCents(row)).toBe(0);
    expect(unsettledCents(row)).toBe(-2000); // $20 to refund
  });

  it('an unpaid deposit collects nothing', () => {
    expect(netCollectedCents(online({ deposit_payment_status: 'pending' }))).toBe(0);
  });

  it('manual bookings: deposit_paid_cents is everything collected', () => {
    const row: BookingMoneyRow = {
      booking_source: 'manual',
      total_price: 30000,
      deposit_paid_cents: 10000,
      deposit_payment_status: 'paid',
      remaining_balance_amount: 20000,
      remaining_balance_status: 'pending',
    };
    expect(netCollectedCents(row)).toBe(10000);
    expect(scheduledChargeCents(row)).toBe(0);
    expect(unsettledCents(row)).toBe(20000);
    expect(rescheduleBalance(row, 50000)).toBeNull();
  });
});

describe('rescheduleBalance', () => {
  it('a higher price raises the automatic charge', () => {
    expect(rescheduleBalance(online(), 45000)).toEqual({
      remaining_balance_amount: 25000,
      remaining_balance_status: 'pending',
    });
  });

  it('a lower price above what was paid lowers it', () => {
    expect(rescheduleBalance(online(), 30000)).toEqual({
      remaining_balance_amount: 10000,
      remaining_balance_status: 'pending',
    });
  });

  it('a price below what was paid waives the balance and leaves a refund owed', () => {
    const row = online();
    const balance = rescheduleBalance(row, 15000);
    expect(balance).toEqual({ remaining_balance_amount: 0, remaining_balance_status: 'waived' });
    expect(unsettledCents({ ...row, ...balance, total_price: 15000 })).toBe(-5000);
  });

  it('waives a remainder under the Stripe minimum', () => {
    expect(rescheduleBalance(online(), 20040)).toEqual({
      remaining_balance_amount: 0,
      remaining_balance_status: 'waived',
    });
  });

  it('keeps a failed charge failed so the admin can retry the new amount', () => {
    expect(rescheduleBalance(online({ remaining_balance_status: 'failed' }), 42000)).toEqual({
      remaining_balance_amount: 22000,
      remaining_balance_status: 'failed',
    });
  });

  it('puts a waived balance back on the card when the price goes up again', () => {
    expect(
      rescheduleBalance(online({ remaining_balance_status: 'waived', remaining_balance_amount: 0 }), 26000)
    ).toEqual({ remaining_balance_amount: 6000, remaining_balance_status: 'pending' });
  });

  it('leaves an already charged balance alone', () => {
    expect(rescheduleBalance(online({ remaining_balance_status: 'paid' }), 50000)).toBeNull();
  });

  it('needs a saved card', () => {
    expect(rescheduleBalance(online({ stripe_payment_method_id: null }), 50000)).toBeNull();
  });
});

describe('remainingBalanceDueAt', () => {
  it('is the start of the UTC day before the tour', () => {
    expect(remainingBalanceDueAt('2026-11-01')).toBe('2026-10-31T00:00:00.000Z');
  });
});
