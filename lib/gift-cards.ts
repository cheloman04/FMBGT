// Pure gift-card helpers shared by server + client. Keep this file client-safe
// (no node:crypto / no DB) so it can be imported from React components.

export const GIFT_CARD_LABEL = 'Gift Card';

export interface GiftCardSummary {
  id: string;
  code: string;
  amount_cents: number;
}

/**
 * Amount of a single-use gift card actually applied to a booking total.
 * Capped at the total (leftover value is forfeited — single-use model).
 */
export function calcGiftCardApplied(amountCents: number, totalCents: number): number {
  if (totalCents <= 0) return 0;
  return Math.min(amountCents, totalCents);
}
