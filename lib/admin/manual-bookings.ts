// The list of manual bookings (/admin/manual-booking, under the form that creates
// them): the bookings list's row plus the waiver link, to send or hand over on
// site without opening the booking. Everything else (edit, record a payment, the
// email, the calendar) is on the booking's page, where each row goes. Pure — the
// query is in ./loaders.ts.
import { waiverLinkUrl, type BookingPageRecord } from './booking-page';
import { toBookingRow, type BookingRecord, type BookingRow } from './bookings';

/** A manual booking as the list reads it: the bookings list's record plus its waiver link. */
export type ManualBookingRecord = BookingRecord & Pick<BookingPageRecord, 'waiver_accepted' | 'waiver_link_token'>;

export type ManualRow = BookingRow & {
  /** Only on a confirmed tour: a cancelled one has nobody left to sign. */
  waiverUrl: string | null;
};

export function toManualRow(b: ManualBookingRecord, waiverCount: number, appUrl: string): ManualRow {
  return { ...toBookingRow(b, waiverCount), waiverUrl: b.status === 'confirmed' ? waiverLinkUrl(b, appUrl) : null };
}

export const MANUAL_EMPTY = 'No manual bookings yet. The ones created above land here, most recent first.';
