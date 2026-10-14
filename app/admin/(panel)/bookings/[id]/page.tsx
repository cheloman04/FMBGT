import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BackLink, EmptyState, PageHeader, PageShell, Section, StatusBadge, buttonClasses } from '@/components/kit';
import { getAppUrl } from '@/lib/app-url';
import { requireOperator } from '@/lib/admin/auth';
import { savedNotice } from '@/lib/admin/booking-form';
import { toBookingPage } from '@/lib/admin/booking-page';
import { loadBookingPage } from '@/lib/admin/loaders';
import { parseUuid } from '@/lib/admin/params';
import { SAVE_OUTCOME } from '@/lib/admin/status-meta';
import { BookingQuickView } from '../_components/BookingQuickView';
import { MoneyActions } from './_components/MoneyActions';
import { WaiverLink } from './_components/WaiverLink';

export const metadata = { title: 'Booking | Admin' };
export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

// One booking, online or manual (phase 2, step 4a): the drawer's quick view —
// the same component — plus what only the page has: Edit, the money actions,
// the waiver link, the notes and the booking's history.
export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  await requireOperator();
  const id = parseUuid((await params).id);
  if (!id) notFound();
  const data = await loadBookingPage(id);
  if (!data) notFound();

  const view = toBookingPage(data.record, data.waivers, data.review, data.history, getAppUrl());
  const saved = savedNotice(await searchParams);
  const self = `/admin/bookings/${id}`;

  return (
    <PageShell>
      <BackLink href="/admin/bookings" label="Bookings" />
      <PageHeader
        eyebrow="Tours"
        title={view.title}
        subtitle={view.subtitle}
        actions={
          view.editHref ? (
            <Link href={view.editHref} className={buttonClasses('primary', 'md')}>
              Edit booking
            </Link>
          ) : undefined
        }
      />

      {/* What the last save did, from the edit page (?saved=…). */}
      {saved ? (
        <div role="status" className="mb-8 flex flex-wrap items-start gap-3 border-b border-hairline pb-4">
          <StatusBadge meta={saved.attention ? SAVE_OUTCOME.check : SAVE_OUTCOME.saved} size="sm" />
          <p className="min-w-0 flex-1 basis-64 text-sm text-fg-2">{saved.lines.join(' ')}</p>
          <Link href={self} className={buttonClasses('ghost', 'sm')} scroll={false}>
            Dismiss
          </Link>
        </div>
      ) : null}

      <div className="max-w-3xl space-y-8">
        <BookingQuickView
          booking={view.detail}
          closeHref="/admin/bookings"
          payment={<MoneyActions bookingId={id} actions={view.money} paymentMethod={data.record.payment_method} />}
          waivers={
            view.waiver.coverage || view.waiver.url ? (
              <div className="space-y-3">
                {view.waiver.coverage ? <StatusBadge meta={view.waiver.coverage} size="sm" /> : null}
                {view.waiver.url ? <WaiverLink url={view.waiver.url} /> : null}
              </div>
            ) : undefined
          }
        />

        {view.notes ? (
          <Section title="Notes" subtitle="Internal: the customer never sees them.">
            <p className="whitespace-pre-line break-words text-sm text-fg-2">{view.notes}</p>
          </Section>
        ) : null}

        <Section title="History" subtitle="From the Financial log, newest first.">
          {view.history.length ? (
            <ul className="divide-y divide-hairline">
              {view.history.map((row) => (
                <li key={row.id} className="py-2.5 first:pt-0">
                  <p className="break-words text-sm text-fg-2">{row.text}</p>
                  <p className="text-xs text-fg-muted">{row.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing logged yet. Payments, refunds and edits of this booking land here." />
          )}
        </Section>
      </div>
    </PageShell>
  );
}
