import {
  EmptyState,
  LoadMore,
  PageHeader,
  PageShell,
  ResponsiveList,
  Section,
  StatusBadge,
  withParam,
  type Column,
} from '@/components/kit';
import { getAppUrl } from '@/lib/app-url';
import { requireOperator } from '@/lib/admin/auth';
import { loadFormLocations, loadManualBookings } from '@/lib/admin/loaders';
import { MANUAL_EMPTY, toManualRow, type ManualRow } from '@/lib/admin/manual-bookings';
import { PAGE_SIZE, parsePage } from '@/lib/admin/params';
import { BookingForm } from '../_components/BookingForm';
import { WaiverActions } from './_components/WaiverActions';

export const metadata = { title: 'Manual booking | Admin' };
export const dynamic = 'force-dynamic';

const PATH = '/admin/manual-booking';

type Params = Record<string, string | string[] | undefined>;

const bookingHref = (id: string) => `/admin/bookings/${id}`;

// The list turns into a table from 672px of its own width (`tableFrom="md"`, a
// container query: the side menu, open or folded, decides as much as the
// screen). Below, rows. The cells' `@2xl:` / `@max-2xl:` are that same line, so
// the two must move together.
const COLUMNS: Column<ManualRow>[] = [
  {
    key: 'booking',
    header: 'Booking',
    // Who, then when: the tour date is what the row is looked up by.
    cell: (r) => (
      <>
        <span className="block">{r.customer}</span>
        <span className="block text-xs font-normal text-fg-muted @4xl:whitespace-nowrap">{r.when}</span>
      </>
    ),
  },
  {
    key: 'tour',
    header: 'Tour',
    // Two lines in the table, one in the rows ("Santos · MTB · 2h · 1 rider").
    cell: (r) => (
      <>
        <span className="@2xl:block">{r.location ?? '—'}</span>
        <span aria-hidden="true" className="@2xl:hidden">
          ·
        </span>
        <span className="text-xs text-fg-muted @2xl:block">{r.tour}</span>
      </>
    ),
  },
  {
    key: 'total',
    header: 'Total',
    cell: (r) => (
      <>
        <span className="@2xl:block">{r.total}</span>
        <span className="block text-xs text-fg-muted @max-2xl:hidden">{r.payment}</span>
      </>
    ),
    align: 'right',
  },
  {
    key: 'status',
    header: 'Status',
    cell: (r) => (
      // In the rows the badges sit right of the name: past two, they stack.
      <span className="flex flex-wrap items-center justify-end gap-1 @max-2xl:max-w-[10rem] @2xl:justify-start">
        <StatusBadge meta={r.status} size="sm" />
        {r.flags.map((flag) => (
          <StatusBadge key={flag.label} meta={flag} size="sm" />
        ))}
      </span>
    ),
    mobile: 'status',
  },
  {
    key: 'waiver',
    header: 'Waiver',
    cell: (r) => (r.waiverUrl ? <WaiverActions url={r.waiverUrl} bookingHref={bookingHref(r.id)} /> : null),
    align: 'right',
    mobile: 'actions',
    interactive: true,
  },
];

// Manual bookings (phase 2, step 4b): the shared booking form, to create one,
// and the ones created, each going to its page — where it is edited, paid,
// emailed and put on the calendar. The row keeps only the waiver link, for the
// day of the tour.
export default async function ManualBookingPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOperator();
  const params = await searchParams;
  const page = parsePage(params.page);
  const [locations, list] = await Promise.all([loadFormLocations(), loadManualBookings(page * PAGE_SIZE)]);
  const appUrl = getAppUrl();
  const rows = list.records.map((b) => toManualRow(b, list.waiverCounts.get(b.id) ?? 0, appUrl));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Tours"
        title="Manual booking"
        subtitle="Cash or off-platform bookings. It books the calendar, logs the money and makes the waiver link: nothing is charged."
      />

      <BookingForm mode="create" locations={locations} />

      <div className="mt-14">
        <Section
          title="Manual bookings"
          subtitle="Most recently created first. Open one to edit it, record a payment, resend the email or retry the calendar."
        >
          <ResponsiveList
            rows={rows}
            columns={COLUMNS}
            rowKey={(r) => r.id}
            rowHref={(r) => bookingHref(r.id)}
            caption="Manual bookings"
            tableFrom="md"
            mobileActions="fill"
            empty={<EmptyState title={MANUAL_EMPTY} />}
          />
          {rows.length ? (
            <LoadMore
              showing={rows.length}
              total={list.total}
              noun="manual bookings"
              moreHref={withParam(PATH, params, 'page', String(page + 1))}
            />
          ) : null}
        </Section>
      </div>
    </PageShell>
  );
}
