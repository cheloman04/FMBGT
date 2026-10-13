// Every status the admin paints, one map per domain (KIGARU_DASHBOARD_STANDARD_V1.md
// §6.2). Two screens that paint the same status in different colours is a bug:
// import from here, never write a tone next to a status.
import type { StatusMeta } from '@/components/kit';

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
