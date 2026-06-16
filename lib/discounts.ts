// Discount resolution logic.
// FAM-FMBGT is the fixed Friends & Family code (hardcoded, 20%).
// Partnership codes are stored in the referral_partners table (DB-backed).

export const FAM_CODE = 'FAM-FMBGT';
export const FAM_PERCENTAGE = 20;
export const FAM_LABEL = 'Friends & Family Discount';

export interface DiscountDef {
  code: string;
  label: string;
  percentage: number;
  partner_id?: string; // set for DB-backed partner codes
}

/** Resolve FAM-FMBGT without hitting the DB. Returns null for any other code. */
export function resolveFamDiscount(code: string | null | undefined): DiscountDef | null {
  if (!code) return null;
  if (code.trim().toUpperCase() === FAM_CODE) {
    return { code: FAM_CODE, label: FAM_LABEL, percentage: FAM_PERCENTAGE };
  }
  return null;
}

/** Calculate discount amount in cents (rounds down). */
export function calcDiscountAmount(totalCents: number, percentage: number): number {
  return Math.floor((totalCents * percentage) / 100);
}

/**
 * A code applied at checkout — either a percentage discount (FAM / partner) or
 * a fixed-amount gift card. Shared by the payment UI and price summary.
 */
export interface AppliedCode {
  type: 'discount' | 'gift_card';
  code: string;
  label: string;
  percentage?: number;        // discount only
  partner_id?: string | null; // discount only
  amount_cents?: number;      // gift_card only (face value)
  gift_card_id?: string | null;
}

/** Reduction in cents an applied code yields against a base total (incl. tax). */
export function appliedReductionCents(
  applied: AppliedCode | null | undefined,
  baseTotalCents: number
): number {
  if (!applied || baseTotalCents <= 0) return 0;
  if (applied.type === 'gift_card') {
    return Math.min(applied.amount_cents ?? 0, baseTotalCents);
  }
  return calcDiscountAmount(baseTotalCents, applied.percentage ?? 0);
}

/** Generate a suggested discount code from a partner name.
 *  "Biclicketa Bike Store" -> "BIC-FMBGT-001"
 *  Sequence suffix must be supplied by caller (e.g. from DB count).
 */
export function suggestPartnerCode(partnerName: string, seq: number = 1): string {
  const prefix = partnerName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X');
  const suffix = String(seq).padStart(3, '0');
  return `${prefix}-FMBGT-${suffix}`;
}
