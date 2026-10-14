// The page of one booking (/admin/bookings/[id]): the drawer's quick view
// (./bookings.ts, toBookingDetail) plus what only the page has — the money
// actions an edit may call for, the waiver link, the internal notes and the
// booking's history from the Financial log. Pure — the queries are in ./loaders.ts.
import type { StatusMeta } from '@/components/kit';
import { netCollectedCents, scheduledChargeCents, unsettledCents } from '@/lib/booking-money';
import { formatFloridaCalendarDate, formatFloridaDateTime, formatTourTime } from '@/lib/display-time';
import { formatPrice } from '@/lib/pricing';
import type { EditableBooking } from './booking-form';
import { toBookingDetail, type BookingDetailView, type BookingRecord, type ReviewEnrollment, type WaiverRecord } from './bookings';
import { WAIVER_COVERAGE } from './status-meta';

// ─── Records ────────────────────────────────────────────────────────────────

/** A booking as its page reads it: the list's record plus what the page and the edit form need. */
export type BookingPageRecord = BookingRecord &
  Pick<EditableBooking, 'skill_level' | 'addons' | 'payment_method' | 'admin_notes'> & {
    waiver_accepted: boolean | null;
    waiver_link_token: string | null;
  };

export type HistoryRecord = {
  id: string;
  event_name: string;
  message: string | null;
  amount: number | null;
  occurred_at: string;
};

// ─── Money ──────────────────────────────────────────────────────────────────

export type MoneyActionKind = 'charge_card' | 'record_payment' | 'refund_card' | 'record_refund' | 'manual_payment';

/** One money action: its button, and the dialog that asks for the amount before it runs. */
export type MoneyAction = {
  kind: MoneyActionKind;
  label: string;
  title: string;
  /** What it does, in the dialog. */
  description: string;
  confirmLabel: string;
  /** The amount it opens with, in dollars ("45.00"), or "" to type one. */
  amount: string;
  /** Asks how the money moved (cash, Zelle…). */
  method: boolean;
  /** Asks why (internal). */
  reason: boolean;
  /** Moves money in Stripe now. */
  danger: boolean;
};

const dollars = (cents: number) => (cents > 0 ? (cents / 100).toFixed(2) : '');

/**
 * The money an operator can move on a booking, each where the API would take
 * it (the route checks again). Online: charge the saved card, record a payment,
 * refund to the card, record a cash refund (/api/admin/bookings/[id]/payments).
 * Manual: record a payment toward its balance (/api/admin/manual-booking).
 * Only on a booking that is on (confirmed) or done (completed).
 */
export function moneyActions(b: BookingPageRecord): MoneyAction[] {
  if (b.status !== 'confirmed' && b.status !== 'completed') return [];
  const unsettled = unsettledCents(b);
  const owed = Math.max(0, unsettled);
  const refundOwed = Math.max(0, -unsettled);
  const collected = netCollectedCents(b);

  if (b.booking_source === 'manual') {
    return owed > 0
      ? [
          {
            kind: 'manual_payment',
            label: 'Record payment',
            title: 'Record a payment',
            description: `Records money received outside the website. Nothing is charged. ${formatPrice(owed)} is still due.`,
            confirmLabel: 'Record payment',
            amount: dollars(owed),
            method: true,
            reason: false,
            danger: false,
          },
        ]
      : [];
  }

  const scheduled = scheduledChargeCents(b);
  // A payment in cash can also cover the balance waiting for the card: it lowers that charge.
  const payable = owed + scheduled;
  const actions: MoneyAction[] = [];
  if (owed > 0 && b.stripe_payment_method_id) {
    actions.push({
      kind: 'charge_card',
      label: `Charge card ${formatPrice(owed)}`,
      title: 'Charge the saved card',
      description: 'Charges the card the customer saved at checkout, now, through Stripe.',
      confirmLabel: 'Charge now',
      amount: dollars(owed),
      method: false,
      reason: false,
      danger: true,
    });
  }
  if (payable > 0) {
    actions.push({
      kind: 'record_payment',
      label: 'Record payment',
      title: 'Record a payment',
      description:
        owed > 0
          ? 'Records money received outside Stripe (cash, Zelle…). Nothing is charged.'
          : 'Records money received outside Stripe (cash, Zelle…). Nothing is charged; it lowers the balance the card will be charged.',
      confirmLabel: 'Record payment',
      amount: dollars(owed > 0 ? owed : payable),
      method: true,
      reason: false,
      danger: false,
    });
  }
  if (collected > 0) {
    actions.push(
      {
        kind: 'refund_card',
        label: refundOwed > 0 ? `Refund ${formatPrice(refundOwed)} to card` : 'Refund to card',
        title: 'Refund to the card',
        description: 'Refunds to the customer’s card through Stripe, now. The booking stays active.',
        confirmLabel: 'Refund now',
        amount: dollars(refundOwed),
        method: false,
        reason: true,
        danger: true,
      },
      {
        kind: 'record_refund',
        label: 'Record cash refund',
        title: 'Record a refund given outside Stripe',
        description: 'Records money you gave back outside Stripe (cash, Zelle…). Nothing moves in Stripe.',
        confirmLabel: 'Record refund',
        amount: dollars(refundOwed),
        method: true,
        reason: true,
        danger: false,
      },
    );
  }
  return actions;
}

// ─── The page ───────────────────────────────────────────────────────────────

export type HistoryRow = { id: string; text: string; detail: string };

export function historyRows(entries: readonly HistoryRecord[]): HistoryRow[] {
  return entries.map((e) => ({
    id: e.id,
    text: e.message || e.event_name,
    detail: [e.amount ? formatPrice(e.amount) : null, formatFloridaDateTime(e.occurred_at)].filter(Boolean).join(' · '),
  }));
}

export type BookingPageView = {
  detail: BookingDetailView;
  title: string;
  subtitle: string;
  /** The edit page: only a confirmed tour is edited. */
  editHref: string | null;
  money: MoneyAction[];
  /**
   * Whether the signatures cover every rider — only once someone signed: with
   * none, "No waivers" already says it — and the link riders sign at (a kiosk
   * on site, or sent) while someone still has to.
   */
  waiver: { coverage: StatusMeta | null; url: string | null };
  notes: string | null;
  history: HistoryRow[];
};

/**
 * The link riders sign the waiver at (a kiosk on site, or sent) while someone
 * still has to: null once the signatures cover every rider.
 */
export function waiverLinkUrl(b: Pick<BookingPageRecord, 'waiver_accepted' | 'waiver_link_token'>, appUrl: string): string | null {
  return !b.waiver_accepted && b.waiver_link_token ? `${appUrl.replace(/\/$/, '')}/waiver/${b.waiver_link_token}` : null;
}

export function toBookingPage(
  b: BookingPageRecord,
  waivers: readonly WaiverRecord[],
  review: ReviewEnrollment | null,
  history: readonly HistoryRecord[],
  appUrl: string,
): BookingPageView {
  const covered = Boolean(b.waiver_accepted);
  const when = `${formatFloridaCalendarDate(b.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}${
    b.time_slot ? ` · ${formatTourTime(b.time_slot, { withZone: true })}` : ''
  }`;
  return {
    detail: toBookingDetail(b, waivers, review),
    title: b.customer_name || 'Customer',
    subtitle: [b.location_name, when].filter(Boolean).join(' · '),
    editHref: b.status === 'confirmed' ? `/admin/bookings/${b.id}/edit` : null,
    money: moneyActions(b),
    waiver: {
      coverage: waivers.length ? (covered ? WAIVER_COVERAGE.covered : WAIVER_COVERAGE.needed) : null,
      url: waiverLinkUrl(b, appUrl),
    },
    notes: b.admin_notes?.trim() || null,
    history: historyRows(history),
  };
}
