// The /admin overview: the figures of its strip, the next booking and what
// needs attention. Pure — the queries are in ./loaders.ts.
//
// Money comes from lib/booking-money.ts, the same functions the booking detail
// uses (KIGARU_DASHBOARD_STANDARD_V1.md §8.2: one calculation, or one of the two
// screens is wrong).
import type { Metric, StatusMeta } from '@/components/kit';
import { easternLocalToUtcIso } from '@/lib/booking-datetime';
import { bookingTotalCents, netCollectedCents, type BookingMoneyRow } from '@/lib/booking-money';
import { formatFloridaCalendarDate, formatTourTime } from '@/lib/display-time';
import { formatPrice } from '@/lib/pricing';
import { isFailedCharge } from './bookings';
import { BOOKING_STATUS, type BookingStatus } from './status-meta';

export type OverviewBooking = BookingMoneyRow & { status: BookingStatus };

export type OverviewLead = {
  id: string;
  status: string;
  booking_id: string | null;
  converted_at: string | null;
};

export type OverviewStats = {
  /** Net of refunds, across every real booking. */
  collectedCents: number;
  /** What confirmed bookings still have to pay, and how many of them. */
  toCollectCents: number;
  toCollectCount: number;
  failedCharges: number;
  confirmed: number;
  completed: number;
  activeLeads: number;
  /** Converted / all leads, in %; null with no leads yet. */
  conversionRate: number | null;
};

/** A lead counts as converted if anything says so — status, link or a payment signal on its bookings. */
export function isConverted(lead: OverviewLead, withPaymentSignal: ReadonlySet<string>): boolean {
  return withPaymentSignal.has(lead.id) || lead.status === 'converted' || !!lead.booking_id || !!lead.converted_at;
}

export function computeOverview(
  bookings: readonly OverviewBooking[],
  leads: readonly OverviewLead[],
  withPaymentSignal: ReadonlySet<string>,
): OverviewStats {
  // `pending` is a checkout that never paid: not a booking yet.
  const real = bookings.filter((b) => b.status !== 'pending');
  const confirmed = real.filter((b) => b.status === 'confirmed');
  const owed = confirmed
    .map((b) => Math.max(0, bookingTotalCents(b) - netCollectedCents(b)))
    .filter((cents) => cents > 0);
  const converted = leads.filter((l) => isConverted(l, withPaymentSignal)).length;

  return {
    // A refunded booking counts zero: a full refund from before refunded_cents
    // existed would otherwise still count as collected.
    collectedCents: real.filter((b) => b.status !== 'refunded').reduce((sum, b) => sum + netCollectedCents(b), 0),
    toCollectCents: owed.reduce((sum, cents) => sum + cents, 0),
    toCollectCount: owed.length,
    // The same rule as the Bookings badge and its failed filter: only a charge that can be retried.
    failedCharges: real.filter(isFailedCharge).length,
    confirmed: confirmed.length,
    completed: real.filter((b) => b.status === 'completed').length,
    activeLeads: leads.filter((l) => l.status === 'lead' && !isConverted(l, withPaymentSignal)).length,
    conversionRate: leads.length ? Math.round((converted / leads.length) * 100) : null,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function overviewMetrics(stats: OverviewStats): Metric[] {
  return [
    {
      key: 'collected',
      label: 'Collected',
      value: formatPrice(stats.collectedCents),
      sub: 'Net of refunds',
    },
    {
      key: 'to-collect',
      label: 'To collect',
      value: formatPrice(stats.toCollectCents),
      sub: stats.toCollectCount
        ? `On ${plural(stats.toCollectCount, 'confirmed booking')}`
        : 'Nothing outstanding',
    },
    {
      key: 'confirmed',
      label: 'Confirmed',
      value: String(stats.confirmed),
      sub: `${stats.completed} completed`,
      href: '/admin/bookings?status=confirmed',
    },
    {
      key: 'leads',
      label: 'Open leads',
      value: String(stats.activeLeads),
      sub: stats.conversionRate === null ? 'No leads yet' : `${stats.conversionRate}% converted`,
      href: '/admin/leads',
    },
  ];
}

// ─── Next booking ───────────────────────────────────────────────────────────

export type NextBookingRecord = BookingMoneyRow & {
  id: string;
  date: string;
  time_slot: string | null;
  trail_type: string | null;
  duration_hours: number | null;
  participant_count: number | null;
  status: BookingStatus;
  customer_name: string | null;
  location_name: string | null;
};

/** When a booking starts, as an instant. time_slot is Eastern wall-clock time. */
function startsAt(b: Pick<NextBookingRecord, 'date' | 'time_slot'>): number {
  try {
    return new Date(easternLocalToUtcIso(b.date, b.time_slot || '00:00')).getTime();
  } catch {
    return Number.NaN; // malformed date or time: never "next"
  }
}

/** The earliest booking that hasn't started yet. */
export function pickNextBooking<T extends Pick<NextBookingRecord, 'date' | 'time_slot'>>(candidates: readonly T[], now: Date): T | null {
  return (
    candidates
      .map((b) => ({ b, at: startsAt(b) }))
      .filter(({ at }) => at >= now.getTime())
      .sort((x, y) => x.at - y.at)[0]?.b ?? null
  );
}

/** "Today", "Tomorrow", "In 11 days" — counted in Florida calendar days. */
export function daysUntil(date: string, today: string): string {
  const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const days = Math.round((day(date) - day(today)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export type NextBookingView = {
  id: string;
  customer: string;
  status: StatusMeta;
  facts: Metric[];
};

export function toNextBooking(b: NextBookingRecord, today: string): NextBookingView {
  const total = bookingTotalCents(b);
  const collected = netCollectedCents(b);
  const due = Math.max(0, total - collected);
  const riders = b.participant_count ?? 1;
  return {
    id: b.id,
    customer: b.customer_name || 'Customer',
    status: BOOKING_STATUS[b.status] ?? BOOKING_STATUS.confirmed,
    facts: [
      {
        key: 'when',
        label: 'When',
        value: `${formatFloridaCalendarDate(b.date, { weekday: 'short', month: 'short', day: 'numeric' })}${b.time_slot ? ` · ${formatTourTime(b.time_slot)}` : ''}`,
        sub: daysUntil(b.date, today),
      },
      { key: 'where', label: 'Where', value: b.location_name || '—' },
      {
        key: 'tour',
        label: 'Tour',
        value: `${b.trail_type === 'mtb' ? 'Mountain bike' : 'Paved'}${b.duration_hours ? ` · ${b.duration_hours}h` : ''}`,
        sub: plural(riders, 'rider'),
      },
      {
        key: 'payment',
        label: 'Total',
        value: formatPrice(total),
        sub: due === 0 ? 'Paid in full' : `${formatPrice(collected)} paid · ${formatPrice(due)} due`,
      },
    ],
  };
}
