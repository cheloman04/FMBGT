import Form from 'next/form';
import Link from 'next/link';
import {
  Button,
  Drawer,
  EmptyState,
  FilterSheet,
  Input,
  LoadMore,
  MetricStrip,
  PageHeader,
  PageShell,
  ResponsiveList,
  Section,
  StatusBadge,
  buttonClasses,
  withParam,
  type Column,
} from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import {
  FILTER_TITLE,
  PAGE_SIZE,
  bookingFilterMetrics,
  bookingFilterOptions,
  bookingsEmpty,
  filterHref,
  parseBookingFilter,
  parseBookingId,
  parsePage,
  parseSearch,
  toBookingDetail,
  toBookingRow,
  type BookingRow,
} from '@/lib/admin/bookings';
import { loadBookingDetail, loadBookingList } from '@/lib/admin/loaders';
import { FAILED_CHARGE } from '@/lib/admin/status-meta';
import { BookingQuickView } from './_components/BookingQuickView';

export const metadata = { title: 'Bookings | Admin' };
export const dynamic = 'force-dynamic';

const PATH = '/admin/bookings';

type Params = Record<string, string | string[] | undefined>;

const COLUMNS: Column<BookingRow>[] = [
  {
    key: 'customer',
    header: 'Customer',
    cell: (r) => (
      <>
        <span className="block">{r.customer}</span>
        {/* From lg up: on a tablet the table needs the room, and the drawer has the email. */}
        {r.email ? <span className="block text-xs font-normal text-fg-muted max-lg:hidden">{r.email}</span> : null}
      </>
    ),
  },
  { key: 'when', header: 'Tour date', cell: (r) => <span className="xl:whitespace-nowrap">{r.when}</span>, mobile: 'secondary' },
  {
    key: 'tour',
    header: 'Tour',
    // One line on the phone ("Santos · MTB · 2h · 1 rider"), two in the table.
    cell: (r) => (
      <>
        <span className="md:block">{r.location ?? '—'}</span>
        <span aria-hidden="true" className="md:hidden">
          ·
        </span>
        <span className="text-xs text-fg-muted md:block">{r.tour}</span>
      </>
    ),
  },
  {
    key: 'total',
    header: 'Total',
    cell: (r) => (
      <>
        <span className="md:block">{r.total}</span>
        <span className="block text-xs text-fg-muted max-md:hidden">{r.payment}</span>
      </>
    ),
    align: 'right',
  },
  {
    key: 'status',
    header: 'Status',
    cell: (r) => (
      // On the phone the badges sit right of the name: past two, they stack.
      <span className="flex flex-wrap items-center justify-end gap-1 max-md:max-w-[10rem] md:justify-start">
        <StatusBadge meta={r.status} size="sm" />
        {r.flags.map((flag) => (
          <StatusBadge key={flag.label} meta={flag} size="sm" />
        ))}
      </span>
    ),
    mobile: 'status',
  },
];

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOperator();
  const params = await searchParams;
  const filter = parseBookingFilter(params.status);
  const q = parseSearch(params.q);
  const page = parsePage(params.page);
  const drawerOpen = Boolean(params.booking);
  const openId = parseBookingId(params.booking);

  const [list, opened] = await Promise.all([
    loadBookingList({ filter, q, limit: page * PAGE_SIZE }),
    openId ? loadBookingDetail(openId) : Promise.resolve(null),
  ]);
  const rows = list.records.map((r) => toBookingRow(r, list.waiverCounts.get(r.id) ?? 0));
  const detail = opened ? toBookingDetail(opened.record, opened.waivers, opened.review) : null;
  const failed = list.counts.failed;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Tours"
        title="Bookings"
        subtitle="Paid online or added by hand, newest tour date first. Times in Eastern."
        actions={
          <Link href="/admin/manual-booking" className={buttonClasses('primary', 'md')}>
            New manual booking
          </Link>
        }
      />
      {/* On a wide screen the strip is the status filter; on the phone, the FilterSheet below. */}
      <div className="max-md:hidden">
        <MetricStrip metrics={bookingFilterMetrics(list.counts, filter, PATH, params)} />
      </div>

      {failed > 0 && filter !== 'failed' ? (
        <div role="status" className="mt-6 flex flex-wrap items-center gap-3">
          <StatusBadge meta={FAILED_CHARGE} size="sm" />
          <p className="text-sm text-fg-2">
            {failed === 1 ? 'The balance charge of 1 booking failed.' : `The balance charges of ${failed} bookings failed.`}
          </p>
          <Link href={filterHref(PATH, params, 'failed')} className={buttonClasses('secondary', 'sm')}>
            Show {failed === 1 ? 'it' : 'them'}
          </Link>
        </div>
      ) : null}

      <div className="mt-8">
        <Section
          title={FILTER_TITLE[filter]}
          subtitle={q ? `${list.total === 1 ? '1 booking matches' : `${list.total} bookings match`} “${q}”.` : undefined}
        >
          {/* A GET form: `next/form` turns it into a client navigation to ?q=, keeping the filter. */}
          <Form action={PATH} role="search" className="mb-4 flex flex-wrap items-end gap-2">
            {filter !== 'all' ? <input type="hidden" name="status" value={filter} /> : null}
            <Input
              key={q}
              type="search"
              name="q"
              defaultValue={q}
              label="Search bookings"
              labelHidden
              placeholder="Name, email, phone, location, ZIP or code"
              layout="min-w-0 flex-1 basis-56"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {q ? (
              <Link href={withParam(PATH, params, 'q', null)} className={buttonClasses('ghost', 'md')}>
                Clear
              </Link>
            ) : null}
          </Form>

          <FilterSheet
            dimension="Status"
            options={bookingFilterOptions(list.counts, filter, PATH, params)}
            active={filter === 'all' ? undefined : filter}
            shown={list.total}
            total={list.counts.all}
            dialogLabel="Filter bookings"
          />

          <ResponsiveList
            rows={rows}
            columns={COLUMNS}
            rowKey={(r) => r.id}
            rowHref={(r) => withParam(PATH, params, 'booking', r.id, { keepPage: true })}
            caption={FILTER_TITLE[filter]}
            empty={<EmptyState title={bookingsEmpty(filter, q)} />}
          />
          {rows.length ? (
            <LoadMore
              showing={rows.length}
              total={list.total}
              noun="bookings"
              moreHref={withParam(PATH, params, 'page', String(page + 1))}
            />
          ) : null}
        </Section>
      </div>

      {/* The quick view lives in the URL (?booking=<id>): it can be shared, and Back or Escape close it. */}
      <Drawer
        open={drawerOpen}
        title={detail?.customer ?? 'Booking not found'}
        closeHref={withParam(PATH, params, 'booking', null, { keepPage: true })}
        size="lg"
        footer={
          detail ? (
            <Link href={`/admin/bookings/${detail.id}`} className={buttonClasses('primary', 'sm')}>
              Open / Edit
            </Link>
          ) : null
        }
      >
        {detail ? (
          <BookingQuickView booking={detail} />
        ) : (
          <EmptyState title="This booking doesn't exist or was archived. Archived bookings are in the Trash, on the Dashboard." />
        )}
      </Drawer>
    </PageShell>
  );
}
