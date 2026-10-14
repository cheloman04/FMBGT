// The Trash of the admin (/admin/trash): archived bookings and leads, the page
// of each list in the URL (§4.7), the rows and what their two actions say
// before they run. Pure — the queries are in ./loaders.ts.
//
// Only what has a payment or a confirmation lands here: /api/admin/delete-booking
// and /api/admin/delete-lead archive those, and delete everything else outright.
// Archiving a booking also sets it Cancelled and cancels its Cal.com event.
import { withParam, type ConfirmRequest, type SearchParamsInput, type StatusMeta } from '@/components/kit';
import { netCollectedCents, bookingTotalCents, type BookingMoneyRow } from '@/lib/booking-money';
import { formatFloridaCalendarDate, formatFloridaDateOnly, formatTourTime } from '@/lib/display-time';
import { formatPrice } from '@/lib/pricing';
import { isConvertedLead } from './leads';
import { LEAD_STATUS } from './status-meta';

// ─── Records ────────────────────────────────────────────────────────────────

export type TrashedBookingRecord = BookingMoneyRow & {
  id: string;
  status: string;
  date: string;
  time_slot: string | null;
  deleted_at: string;
  deleted_by: string | null;
  customer_name: string | null;
  location_name: string | null;
};

export type TrashedLeadRecord = {
  id: string;
  full_name: string;
  email: string;
  selected_trail_type: string | null;
  selected_location_name: string | null;
  status: string;
  booking_id: string | null;
  converted_at: string | null;
  lost_at: string | null;
  deleted_at: string;
  deleted_by: string | null;
};

// ─── The page of each list in the URL: ?bookingsPage= ?leadsPage= ──────────

export type TrashSection = 'bookings' | 'leads';

/** One "Load more" per list: each keeps its own page, so loading one doesn't reset the other. */
export const TRASH_PAGE_PARAM: Record<TrashSection, string> = {
  bookings: 'bookingsPage',
  leads: 'leadsPage',
};

/** The Trash with one list showing `page` pages, the other as it was. */
export function trashPageHref(path: string, params: SearchParamsInput, section: TrashSection, page: number): string {
  return withParam(path, params, TRASH_PAGE_PARAM[section], page > 1 ? String(page) : null);
}

/** What an empty list says: what's missing and how it fills (§8.5). */
export const TRASH_EMPTY: Record<TrashSection, string> = {
  bookings:
    'No archived bookings. A booking lands here when you delete one that was paid or confirmed; any other booking is deleted outright.',
  leads:
    'No archived leads. A lead lands here when you delete one with a paid or confirmed booking; any other lead is deleted outright.',
};

// ─── The rows ───────────────────────────────────────────────────────────────

/** What a row's two buttons ask before they run: restore, and delete forever. */
export type TrashActionsCopy = { restore: ConfirmRequest; purge: ConfirmRequest };

const archivedOn = (iso: string) => formatFloridaDateOnly(iso);

/** "$609.87 collected", "$50.00 collected · $25.00 refunded", "Nothing collected". */
export function trashedMoney(b: BookingMoneyRow): string {
  const collected = netCollectedCents(b);
  const refunded = b.refunded_cents ?? 0;
  const parts = [collected > 0 ? `${formatPrice(collected)} collected` : null, refunded > 0 ? `${formatPrice(refunded)} refunded` : null];
  return parts.filter(Boolean).join(' · ') || 'Nothing collected';
}

export type TrashedBookingRow = TrashActionsCopy & {
  id: string;
  customer: string;
  location: string | null;
  when: string;
  total: string;
  money: string;
  archived: string;
  archivedBy: string | null;
};

/**
 * /api/admin/restore-booking brings the booking back as Cancelled and does
 * nothing else; /api/admin/purge-booking deletes it with its waiver records and
 * its review request. The customer, Stripe and the Financial log keep theirs.
 */
export function toTrashedBookingRow(b: TrashedBookingRecord): TrashedBookingRow {
  const customer = b.customer_name || 'Customer';
  const owner = b.customer_name ? `${b.customer_name}’s booking` : 'this booking';
  return {
    id: b.id,
    customer,
    location: b.location_name,
    when: `${formatFloridaCalendarDate(b.date)}${b.time_slot ? ` · ${formatTourTime(b.time_slot)}` : ''}`,
    total: formatPrice(bookingTotalCents(b)),
    money: trashedMoney(b),
    archived: archivedOn(b.deleted_at),
    archivedBy: b.deleted_by,
    restore: {
      title: `Restore ${owner}?`,
      description:
        'It goes back to Bookings as Cancelled. No calendar event is created, no money moves and the customer isn’t told. Change its status there if the tour is on after all.',
      confirmLabel: 'Restore booking',
    },
    purge: {
      title: `Delete ${owner} forever?`,
      description:
        'The booking, its waiver records and its review request are deleted. The customer’s contact, the payments in Stripe and the Financial log stay. This can’t be undone.',
      confirmLabel: 'Delete forever',
      cancelLabel: 'Keep it',
      danger: true,
    },
  };
}

/** Booked (by its own columns or a payment on one of its bookings), lost, or open. */
export function trashedLeadStatus(lead: TrashedLeadRecord, hasPaidBooking: boolean): StatusMeta {
  if (hasPaidBooking || isConvertedLead(lead)) return LEAD_STATUS.converted;
  if (lead.status === 'lost' || lead.lost_at) return LEAD_STATUS.lost;
  return LEAD_STATUS.open;
}

export type TrashedLeadRow = TrashActionsCopy & {
  id: string;
  name: string;
  email: string;
  interest: string | null;
  status: StatusMeta;
  archived: string;
  archivedBy: string | null;
};

const TRAIL: Record<string, string> = { mtb: 'MTB', paved: 'Paved' };

/**
 * /api/admin/restore-lead only takes the lead out of the Trash. A booked lead
 * then counts as converted, and the Leads list (open leads) leaves it out:
 * the confirmation says so. /api/admin/purge-lead deletes the lead with its
 * follow-up and its booking-flow sessions; its bookings keep their rows.
 */
export function toTrashedLeadRow(lead: TrashedLeadRecord, hasPaidBooking: boolean): TrashedLeadRow {
  const name = lead.full_name || lead.email;
  const status = trashedLeadStatus(lead, hasPaidBooking);
  return {
    id: lead.id,
    name,
    email: lead.email,
    interest:
      [lead.selected_trail_type ? TRAIL[lead.selected_trail_type] ?? lead.selected_trail_type : null, lead.selected_location_name]
        .filter(Boolean)
        .join(' · ') || null,
    status,
    archived: archivedOn(lead.deleted_at),
    archivedBy: lead.deleted_by,
    restore: {
      title: `Restore ${name}?`,
      description:
        status === LEAD_STATUS.converted
          ? 'The lead leaves the Trash. It has a paid or confirmed booking, so it counts as converted and won’t show among the open leads. Nothing is sent.'
          : `The lead goes back to Leads${status === LEAD_STATUS.lost ? ', under Lost' : ''}. Nothing is sent.`,
      confirmLabel: 'Restore lead',
    },
    purge: {
      title: `Delete ${name} forever?`,
      description:
        'The lead, its follow-up and its booking-flow history are deleted. Its bookings stay, and so does the Financial log. This can’t be undone.',
      confirmLabel: 'Delete forever',
      cancelLabel: 'Keep it',
      danger: true,
    },
  };
}
