// Every status the admin paints, one map per domain (KIGARU_DASHBOARD_STANDARD_V1.md
// §6.2). Two screens that paint the same status in different colours is a bug:
// import from here, never write a tone next to a status.
import type { StatusMeta } from '@/components/kit';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded';

export const BOOKING_STATUS: Record<BookingStatus, StatusMeta> = {
  pending: { label: 'Pending', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  completed: { label: 'Completed', tone: 'blue' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
  refunded: { label: 'Refunded', tone: 'red' },
};

export const FAILED_CHARGE: StatusMeta = { label: 'Charge failed', tone: 'red' };

// The remaining balance of an online booking (deposit at checkout, the rest
// charged to the saved card the day before the tour).
export type BalanceStatus = 'pending' | 'paid' | 'failed' | 'waived';

export const BALANCE_STATUS: Record<BalanceStatus, StatusMeta> = {
  pending: { label: 'Balance scheduled', tone: 'gray' },
  paid: { label: 'Balance paid', tone: 'green' },
  failed: FAILED_CHARGE,
  waived: { label: 'Balance waived', tone: 'gray' },
};

/** The Cal.com event that blocks the slot online (migrations 019 and 032). */
export type CalStatus = 'pending' | 'created' | 'failed' | 'cancelled';

export const CAL_STATUS: Record<CalStatus, StatusMeta> = {
  pending: { label: 'Calendar pending', tone: 'gray' },
  created: { label: 'On calendar', tone: 'green' },
  failed: { label: 'No Cal event', tone: 'amber' },
  cancelled: { label: 'Cal event cancelled', tone: 'gray' },
};

/** The confirmation email (the n8n webhook). */
export const CONFIRMATION_EMAIL = {
  sent: { label: 'Email sent', tone: 'green' },
  notSent: { label: 'Email not sent', tone: 'amber' },
} satisfies Record<string, StatusMeta>;

export type ReviewStatus = 'active' | 'reviewed' | 'completed' | 'cancelled';

/** The review request that starts when a booking is completed. */
export const REVIEW_STATUS: Record<ReviewStatus | 'none', StatusMeta> = {
  none: { label: 'Review not started', tone: 'gray' },
  active: { label: 'Review requested', tone: 'blue' },
  reviewed: { label: 'Review received', tone: 'green' },
  completed: { label: 'Review sequence done', tone: 'gray' },
  cancelled: { label: 'Review request stopped', tone: 'gray' },
};

/** Signed waivers. The label of `signed` is rewritten with the count ("2 waivers"). */
export const WAIVER_STATUS = {
  missing: { label: 'No waivers', tone: 'yellow' },
  signed: { label: 'Signed', tone: 'green' },
} satisfies Record<string, StatusMeta>;

/** A rider who rents a bike needs a height to be fitted. */
export const SIZING_STATUS = {
  missing: { label: 'Size missing', tone: 'amber' },
  ready: { label: 'Sizing ready', tone: 'green' },
} satisfies Record<string, StatusMeta>;

export type GiftCardStatus = 'active' | 'reserved' | 'redeemed' | 'void';

export const GIFT_CARD_STATUS: Record<GiftCardStatus, StatusMeta> = {
  active: { label: 'Active', tone: 'green' },
  reserved: { label: 'Reserved', tone: 'amber' },
  redeemed: { label: 'Redeemed', tone: 'blue' },
  void: { label: 'Void', tone: 'gray' },
};

export const PARTNER_STATUS = {
  active: { label: 'Active', tone: 'green' },
  inactive: { label: 'Inactive', tone: 'gray' },
  // The hardcoded friends & family code: nothing to toggle, it just works.
  builtIn: { label: 'Always active', tone: 'accent' },
} satisfies Record<string, StatusMeta>;

export type FinancialSeverity = 'info' | 'warning' | 'error' | 'critical';

export const FINANCIAL_SEVERITY: Record<FinancialSeverity, StatusMeta> = {
  info: { label: 'Info', tone: 'gray' },
  warning: { label: 'Warning', tone: 'yellow' },
  error: { label: 'Error', tone: 'amber' },
  critical: { label: 'Critical', tone: 'red' },
};

export const NEEDS_ATTENTION: StatusMeta = { label: 'Needs attention', tone: 'amber' };
