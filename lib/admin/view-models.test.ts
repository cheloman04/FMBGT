import { describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest — point the imports at the real modules.
vi.mock('@/lib/pricing', () => import('../pricing'));
vi.mock('@/lib/discounts', () => import('../discounts'));
vi.mock('@/lib/display-time', () => import('../display-time'));

const { giftCardMetrics, toGiftCardRow } = await import('./gift-cards');
const { FAMILY_ROW, partnerRows, referralMetrics } = await import('./referrals');
const { formatEventAmount, parseFinLogView, toFinancialEventRow } = await import('./fin-log');

type GiftCard = Parameters<typeof toGiftCardRow>[0];

const card = (over: Partial<GiftCard>): GiftCard => ({
  id: 'id',
  code: 'GIFT-AAAA-BBBB-CCCC',
  amount_cents: 10000,
  status: 'active',
  recipient_name: null,
  recipient_email: null,
  purchaser_name: null,
  notes: null,
  reserved_booking_id: null,
  redeemed_booking_id: null,
  redeemed_amount_cents: null,
  redeemed_at: null,
  created_by: null,
  created_at: '2026-10-01T16:00:00Z',
  ...over,
});

const value = (metrics: { key: string; value: unknown }[], key: string) => metrics.find((m) => m.key === key)?.value;

describe('gift cards', () => {
  it('outstanding counts active and reserved cards, never void or redeemed', () => {
    const metrics = giftCardMetrics([
      card({ amount_cents: 10000 }),
      card({ status: 'reserved', amount_cents: 5000 }),
      card({ status: 'void', amount_cents: 7000 }),
      card({ status: 'redeemed', amount_cents: 2500, redeemed_amount_cents: 2500 }),
    ]);
    expect(value(metrics, 'outstanding')).toBe('$150.00');
    expect(value(metrics, 'redeemed')).toBe('$25.00');
    expect(value(metrics, 'issued')).toBe('4');
  });

  it('says so when every card has been used', () => {
    const outstanding = giftCardMetrics([card({ status: 'redeemed' })]).find((m) => m.key === 'outstanding');
    expect(outstanding?.value).toBe('$0.00');
    expect(outstanding?.sub).toBe('Every card issued has been used');
  });

  it('a row carries formatted money and dates, and the status from the one map', () => {
    const row = toGiftCardRow(
      card({ status: 'redeemed', redeemed_amount_cents: 8000, redeemed_at: '2026-10-03T15:00:00Z', recipient_email: 'jane@example.com' }),
    );
    expect(row.amount).toBe('$100.00');
    expect(row.redeemed).toBe('$80.00 on Oct 3, 2026');
    expect(row.recipient).toBe('jane@example.com');
    expect(row.statusMeta).toEqual({ label: 'Redeemed', tone: 'blue' });
    expect(row.issued).toBe('Oct 1, 2026');
  });
});

describe('referrals', () => {
  const partner = (over: Partial<Parameters<typeof referralMetrics>[0][number]>) => ({
    id: 'p',
    partner_name: 'Biclicketa',
    discount_code: 'BIC-FMBGT-001',
    discount_percentage: 15,
    active: true,
    uses_count: 0,
    notes: null,
    created_at: '2026-10-01T00:00:00Z',
    ...over,
  });

  it('lists the friends & family code first, with no actions', () => {
    const rows = partnerRows([partner({})]);
    expect(rows[0]).toBe(FAMILY_ROW);
    expect(rows[0]).toMatchObject({ code: 'FAM-FMBGT', discount: '20%', builtIn: true });
    expect(rows[1]).toMatchObject({ code: 'BIC-FMBGT-001', discount: '15%', builtIn: false });
  });

  it('counts uses and names the partner with the most', () => {
    const [active, uses] = referralMetrics([
      partner({ id: 'a', partner_name: 'Alpha', uses_count: 2 }),
      partner({ id: 'b', partner_name: 'Beta', uses_count: 5, active: false }),
    ]);
    expect(active).toMatchObject({ value: '1', sub: '1 inactive' });
    expect(uses).toMatchObject({ value: '7', sub: 'Most: Beta (5)' });
  });
});

describe('financial log', () => {
  it('only known views come from the URL', () => {
    expect(parseFinLogView('attention')).toBe('attention');
    expect(parseFinLogView(['critical', 'all'])).toBe('critical');
    expect(parseFinLogView('drop table')).toBe('all');
    expect(parseFinLogView(undefined)).toBe('all');
  });

  it('amounts are cents; USD uses the app formatter, other currencies keep theirs', () => {
    expect(formatEventAmount(12345, 'usd')).toBe('$123.45');
    expect(formatEventAmount(12345, null)).toBe('$123.45');
    expect(formatEventAmount(500, 'EUR')).toBe('€5.00');
    expect(formatEventAmount(null, 'USD')).toBe('—');
  });

  it('an unknown severity falls back to info instead of crashing the page', () => {
    const row = toFinancialEventRow({
      id: 'e',
      event_name: 'payment.recorded',
      event_category: 'payment',
      severity: 'loud' as never,
      entity_type: 'booking',
      entity_id: 'b',
      booking_id: null,
      lead_id: null,
      amount: 3000,
      currency: 'usd',
      status: null,
      requires_attention: false,
      message: null,
      occurred_at: '2026-10-11T22:43:00Z',
    });
    expect(row.severity).toEqual({ label: 'Info', tone: 'gray' });
    expect(row.when).toBe('Oct 11, 2026, 6:43 PM');
    expect(row.status).toBe('—');
  });
});
