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

// The lists turn into a table from 672px of their own width (`tableFrom="md"`,
// a container query: the side menu, open or folded, decides as much as the
// screen). Below, rows. The cells' `@2xl:` / `@max-2xl:` are that same line, so
// the two must move together.

/** When and by whom. Who only on a wide table. */
function Archived({ on, by }: { on: string; by: string | null }) {
  return (
    <span className="@2xl:block">
      {/* In the rows the line needs to say what the date is. */}
      <span className="@2xl:hidden">Archived </span>
      <span className="@2xl:block @2xl:whitespace-nowrap">{on}</span>
      {by ? <span className="block whitespace-nowrap text-xs text-fg-muted @max-4xl:hidden">by {by}</span> : null}
    </span>
  );
}

const BOOKING_COLUMNS: Column<TrashedBookingRow>[] = [
  {
    key: 'booking',
    header: 'Booking',
    // Who, then where and when, in one column. Where and when are two lines in
    // the table, one in the rows.
    cell: (r) => (
      <>
        <span className="block">{r.customer}</span>
        <span className="block text-xs font-normal text-fg-muted">
          {r.location ? (
            <>
              <span className="text-fg-2 @2xl:block">{r.location}</span>
              <span aria-hidden="true" className="@2xl:hidden">
                {' · '}
              </span>
            </>
          ) : null}
          <span className="@2xl:block">{r.when}</span>
        </span>
      </>
    ),
  },
  {
    key: 'money',
    header: 'Total',
    cell: (r) => (
      <span>
        <span className="@2xl:block">{r.total}</span>
        <span aria-hidden="true" className="@2xl:hidden">
          {' · '}
        </span>
        <span className="text-xs text-fg-muted @2xl:block">{r.money}</span>
      </span>
    ),
    align: 'right',
  },
  { key: 'archived', header: 'Archived', cell: (r) => <Archived on={r.archived} by={r.archivedBy} /> },
  {
    key: 'actions',
    header: 'Actions',
    cell: (r) => <TrashActions kind="booking" id={r.id} restore={r.restore} purge={r.purge} />,
    align: 'right',
    mobile: 'actions',
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
        {/* Only on a wide table: the drawer of the lead has it too. */}
        <span className="block text-xs font-normal text-fg-muted @max-3xl:hidden">{r.email}</span>
      </>
    ),
  },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge meta={r.status} size="sm" />, mobile: 'status' },
  { key: 'archived', header: 'Archived', cell: (r) => <Archived on={r.archived} by={r.archivedBy} /> },
  {
    key: 'actions',
    header: 'Actions',
    cell: (r) => <TrashActions kind="lead" id={r.id} restore={r.restore} purge={r.purge} />,
    align: 'right',
    mobile: 'actions',
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
          tableFrom="md"
          mobileActions="fill"
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
            tableFrom="md"
            mobileActions="fill"
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
