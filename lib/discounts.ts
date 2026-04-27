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
