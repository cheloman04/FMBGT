// Gift cards in the admin: the DB record, the row the page renders, and the
// figures of its metric strip. Pure — the loader is in ./loaders.ts.
import type { Metric, StatusMeta } from '@/components/kit';
import { formatFloridaDateOnly } from '@/lib/display-time';
import { formatPrice } from '@/lib/pricing';
import { GIFT_CARD_STATUS, type GiftCardStatus } from './status-meta';

export type GiftCardRecord = {
  id: string;
  code: string;
  amount_cents: number;
  status: GiftCardStatus;
  recipient_name: string | null;
  recipient_email: string | null;
  purchaser_name: string | null;
  notes: string | null;
  reserved_booking_id: string | null;
  redeemed_booking_id: string | null;
  redeemed_amount_cents: number | null;
  redeemed_at: string | null;
  created_by: string | null;
  created_at: string;
};

/** What the list renders: money and dates already formatted (§4.3). */
export type GiftCardRow = {
  id: string;
  code: string;
  amount: string;
  status: GiftCardStatus;
  statusMeta: StatusMeta;
  recipient: string | null;
  /** "$80.00 on Oct 3, 2026", or null if not redeemed. */
  redeemed: string | null;
  issued: string;
  notes: string | null;
};

export function toGiftCardRow(card: GiftCardRecord): GiftCardRow {
  const redeemedCents = card.redeemed_amount_cents ?? card.amount_cents;
  return {
    id: card.id,
    code: card.code,
    amount: formatPrice(card.amount_cents),
    status: card.status,
    statusMeta: GIFT_CARD_STATUS[card.status],
    recipient: card.recipient_name || card.recipient_email || null,
    redeemed:
      card.status === 'redeemed'
        ? `${formatPrice(redeemedCents)}${card.redeemed_at ? ` on ${formatFloridaDateOnly(card.redeemed_at)}` : ''}`
        : null,
    issued: formatFloridaDateOnly(card.created_at),
    notes: card.notes,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Outstanding is what the business still owes in tours: active cards plus the
 * ones reserved mid-checkout. Void cards count for nothing.
 */
export function giftCardMetrics(cards: readonly GiftCardRecord[]): Metric[] {
  const open = cards.filter((c) => c.status === 'active' || c.status === 'reserved');
  const redeemed = cards.filter((c) => c.status === 'redeemed');
  const voided = cards.filter((c) => c.status === 'void').length;
  const sum = (list: readonly GiftCardRecord[], pick: (c: GiftCardRecord) => number) =>
    list.reduce((total, c) => total + pick(c), 0);

  return [
    {
      key: 'outstanding',
      label: 'Outstanding',
      value: formatPrice(sum(open, (c) => c.amount_cents)),
      sub: open.length ? `${plural(open.length, 'card', 'cards')} not used yet` : 'Every card issued has been used',
    },
    {
      key: 'redeemed',
      label: 'Redeemed',
      value: formatPrice(sum(redeemed, (c) => c.redeemed_amount_cents ?? c.amount_cents)),
      sub: plural(redeemed.length, 'card', 'cards'),
    },
    {
      key: 'issued',
      label: 'Issued',
      value: String(cards.length),
      sub: voided ? `${voided} voided` : 'None voided',
    },
  ];
}
