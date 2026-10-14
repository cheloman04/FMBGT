import {
  EmptyState,
  LoadMore,
  PageHeader,
  PageShell,
  ResponsiveList,
  Section,
  StatusBadge,
  type Column,
} from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { loadTrashedBookings, loadTrashedLeads } from '@/lib/admin/loaders';
import { PAGE_SIZE, parsePage } from '@/lib/admin/params';
import {
  TRASH_EMPTY,
  TRASH_PAGE_PARAM,
  toTrashedBookingRow,
  toTrashedLeadRow,
  trashPageHref,
  type TrashedBookingRow,
  type TrashedLeadRow,
} from '@/lib/admin/trash';
import { TrashActions } from './_components/TrashActions';

export const metadata = { title: 'Trash | Admin' };
export const dynamic = 'force-dynamic';

const PATH = '/admin/trash';

type Params = Record<string, string | string[] | undefined>;

// On the phone a row is its lines over the full width, then the two buttons as
// one last line, each half of it. The kit's `actions` role keeps buttons at
// their own width, so they go as the last `secondary` line, and what comes
// before them (the money, the archive date) is `secondary` too, styled as meta.
const PHONE_META = 'max-md:text-xs max-md:text-fg-muted';

/** When and by whom. The email only from xl: at 768 the table needs the room. */
function Archived({ on, by }: { on: string; by: string | null }) {
  return (
    <span className={`block ${PHONE_META}`}>
      {/* On the phone the line needs to say what the date is. */}
      <span className="md:hidden">Archived </span>
      <span className="md:block md:whitespace-nowrap">{on}</span>
      {by ? <span className="block whitespace-nowrap text-xs text-fg-muted max-xl:hidden">by {by}</span> : null}
    </span>
  );
}

const BOOKING_COLUMNS: Column<TrashedBookingRow>[] = [
  {
    key: 'booking',
    header: 'Booking',
    // Who, then where and when, in one column: at 768 the table has ~485px.
    // Where and when are two lines in the table, one on the phone.
    cell: (r) => (
      <>
        <span className="block">{r.customer}</span>
        <span className="block text-xs font-normal text-fg-muted">
          {r.location ? (
            <>
              <span className="text-fg-2 md:block">{r.location}</span>
              <span aria-hidden="true" className="md:hidden">
                {' · '}
              </span>
            </>
          ) : null}
          <span className="md:block">{r.when}</span>
        </span>
      </>
    ),
  },
  {
    key: 'money',
    header: 'Total',
    cell: (r) => (
      <span className={`block ${PHONE_META}`}>
        <span className="md:block">{r.total}</span>
        <span aria-hidden="true" className="md:hidden">
          {' · '}
        </span>
        <span className="text-xs text-fg-muted md:block">{r.money}</span>
      </span>
    ),
    align: 'right',
    mobile: 'secondary',
  },
  { key: 'archived', header: 'Archived', cell: (r) => <Archived on={r.archived} by={r.archivedBy} />, mobile: 'secondary' },
  {
    key: 'actions',
    header: 'Actions',
    cell: (r) => <TrashActions kind="booking" id={r.id} restore={r.restore} purge={r.purge} />,
    align: 'right',
    // Side by side from lg up; at 768 the table has no room and they stack.
    width: 'lg:w-52',
    mobile: 'secondary',
    interactive: true,
  },
];

const LEAD_COLUMNS: Column<TrashedLeadRow>[] = [
  {
    key: 'lead',
    header: 'Lead',
    // Like a booking: who, then what they wanted.
    cell: (r) => (
      <>
        <span className="block">{r.name}</span>
        {r.interest ? <span className="block text-xs font-normal text-fg-2">{r.interest}</span> : null}
        {/* From lg up: on a tablet the table needs the room. */}
        <span className="block text-xs font-normal text-fg-muted max-lg:hidden">{r.email}</span>
      </>
    ),
  },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge meta={r.status} size="sm" />, mobile: 'status' },
  { key: 'archived', header: 'Archived', cell: (r) => <Archived on={r.archived} by={r.archivedBy} />, mobile: 'secondary' },
  {
    key: 'actions',
    header: 'Actions',
    cell: (r) => <TrashActions kind="lead" id={r.id} restore={r.restore} purge={r.purge} />,
    align: 'right',
    // Side by side from lg up; at 768 the table has no room and they stack.
    width: 'lg:w-52',
    mobile: 'secondary',
    interactive: true,
  },
];

export default async function TrashPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOperator();
  const params = await searchParams;
  const bookingsPage = parsePage(params[TRASH_PAGE_PARAM.bookings]);
  const leadsPage = parsePage(params[TRASH_PAGE_PARAM.leads]);

  const [bookings, leads] = await Promise.all([
    loadTrashedBookings(bookingsPage * PAGE_SIZE),
    loadTrashedLeads(leadsPage * PAGE_SIZE),
  ]);
  const bookingRows = bookings.records.map(toTrashedBookingRow);
  const leadRows = leads.records.map((lead) => toTrashedLeadRow(lead, leads.withPaidBooking.has(lead.id)));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Records"
        title="Trash"
        subtitle="Archived bookings and leads, most recently archived first. Restore one, or delete it for good. Dates in Eastern."
      />

      <Section
        title="Archived bookings"
        subtitle="Bookings deleted after a payment or a confirmation. Restored, one comes back to Bookings as Cancelled."
      >
        <ResponsiveList
          rows={bookingRows}
          columns={BOOKING_COLUMNS}
          rowKey={(r) => r.id}
          caption="Archived bookings"
          empty={<EmptyState title={TRASH_EMPTY.bookings} />}
        />
        {bookingRows.length ? (
          <LoadMore
            showing={bookingRows.length}
            total={bookings.total}
            noun="archived bookings"
            moreHref={trashPageHref(PATH, params, 'bookings', bookingsPage + 1)}
          />
        ) : null}
      </Section>

      <div className="mt-10">
        <Section title="Archived leads" subtitle="Leads deleted while one of their bookings was paid or confirmed.">
          <ResponsiveList
            rows={leadRows}
            columns={LEAD_COLUMNS}
            rowKey={(r) => r.id}
            caption="Archived leads"
            empty={<EmptyState title={TRASH_EMPTY.leads} />}
          />
          {leadRows.length ? (
            <LoadMore
              showing={leadRows.length}
              total={leads.total}
              noun="archived leads"
              moreHref={trashPageHref(PATH, params, 'leads', leadsPage + 1)}
            />
          ) : null}
        </Section>
      </div>
    </PageShell>
  );
}
