// The financial log in the admin: the DB record, the views the metric strip
// filters to (kept in the URL, §4.7) and the row the list renders. Pure.
import type { StatusMeta } from '@/components/kit';
import { formatFloridaDateTime } from '@/lib/display-time';
import { formatPrice } from '@/lib/pricing';
import { FINANCIAL_SEVERITY, type FinancialSeverity } from './status-meta';

export type FinancialEventRecord = {
  id: string;
  event_name: string;
  event_category: string;
  severity: FinancialSeverity;
  entity_type: string;
  entity_id: string;
  booking_id: string | null;
  lead_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  requires_attention: boolean;
  message: string | null;
  occurred_at: string;
};

export const FIN_LOG_VIEWS = ['all', 'attention', 'critical', 'reconciliation'] as const;
export type FinLogView = (typeof FIN_LOG_VIEWS)[number];

export function parseFinLogView(raw: string | string[] | undefined): FinLogView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (FIN_LOG_VIEWS as readonly string[]).includes(value ?? '') ? (value as FinLogView) : 'all';
}

export type FinLogCounts = Record<FinLogView, number>;

export type FinancialEventRow = {
  id: string;
  when: string;
  name: string;
  category: string;
  severity: StatusMeta;
  attention: boolean;
  bookingId: string | null;
  amount: string | null;
  status: string | null;
  message: string | null;
};

/** Amounts are cents. USD goes through the app's one formatter; anything else keeps its currency. */
export function formatEventAmount(amount: number | null, currency: string | null): string | null {
  if (amount === null || amount === undefined) return null;
  const code = currency?.toUpperCase() || 'USD';
  if (code === 'USD') return formatPrice(amount);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount / 100);
}

export function toFinancialEventRow(event: FinancialEventRecord): FinancialEventRow {
  return {
    id: event.id,
    when: formatFloridaDateTime(event.occurred_at),
    name: event.event_name,
    category: event.event_category,
    severity: FINANCIAL_SEVERITY[event.severity] ?? FINANCIAL_SEVERITY.info,
    attention: event.requires_attention,
    bookingId: event.booking_id,
    amount: formatEventAmount(event.amount, event.currency),
    status: event.status,
    message: event.message,
  };
}

/** The line under the list when it's empty, per view (§8.5: what's missing and how it fills). */
export const FIN_LOG_EMPTY: Record<FinLogView, string> = {
  all: 'No financial events yet. Payments, refunds and reconciliations appear here as they happen.',
  attention: 'Nothing needs attention. Events flagged by a failed charge or a mismatch show up here.',
  critical: 'No critical events.',
  reconciliation: 'No reconciliation events yet. They appear when a payment is matched or corrected.',
};
