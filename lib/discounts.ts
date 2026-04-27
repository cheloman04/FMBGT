// Controlled discount registry — only these codes are valid.
// Frontend may send the code string; backend resolves percentage here.

export type DiscountCode = 'friends_family_20' | 'partnership_15';

export interface DiscountDef {
  code: DiscountCode;
  label: string;
  percentage: number; // 0–100
}

export const DISCOUNT_REGISTRY: Record<DiscountCode, DiscountDef> = {
  friends_family_20: {
    code: 'friends_family_20',
    label: 'Friends & Family Discount',
    percentage: 20,
  },
  partnership_15: {
    code: 'partnership_15',
    label: 'Partnership Discount',
    percentage: 15,
  },
};

export const DISCOUNT_OPTIONS: DiscountDef[] = Object.values(DISCOUNT_REGISTRY);

/** Resolve a raw string to a valid DiscountDef, or null for "none"/invalid. */
export function resolveDiscount(code: string | null | undefined): DiscountDef | null {
  if (!code || code === 'none') return null;
  return DISCOUNT_REGISTRY[code as DiscountCode] ?? null;
}

/** Calculate discount amount in cents (rounds down). */
export function calcDiscountAmount(subtotalCents: number, percentage: number): number {
  return Math.floor((subtotalCents * percentage) / 100);
}
