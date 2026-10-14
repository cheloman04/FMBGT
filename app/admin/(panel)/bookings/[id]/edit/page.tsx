import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BackLink, EmptyState, PageHeader, PageShell, buttonClasses, resolveStatus } from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { loadBookingForEdit } from '@/lib/admin/loaders';
import { parseUuid } from '@/lib/admin/params';
import { BOOKING_STATUS } from '@/lib/admin/status-meta';
import { formatFloridaCalendarDate, formatTourTime } from '@/lib/display-time';
import { BookingForm } from '../../../_components/BookingForm';

export const metadata = { title: 'Edit booking | Admin' };
export const dynamic = 'force-dynamic';

// The edit of one booking, on its own page (phase 2, step 4a). The form is the
// shared one of app/admin/(panel)/_components; Cancel and the save land back
// on the booking.
export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOperator();
  const id = parseUuid((await params).id);
  if (!id) notFound();
  const data = await loadBookingForEdit(id);
  if (!data) notFound();

  const { record, locations } = data;
  const back = `/admin/bookings/${id}`;
  const customer = record.customer_name || 'Customer';
  const when = `${formatFloridaCalendarDate(record.date)}${record.time_slot ? ` · ${formatTourTime(record.time_slot, { withZone: true })}` : ''}`;

  return (
    <PageShell>
      <BackLink href={back} label={customer} />
      <PageHeader
        eyebrow="Tours"
        title="Edit booking"
        subtitle={[customer, record.location_name, when, record.booking_source === 'manual' ? 'Manual booking' : 'Online booking']
          .filter(Boolean)
          .join(' · ')}
      />
      {record.status === 'confirmed' ? (
        <BookingForm
          booking={{
            id: record.id,
            booking_source: record.booking_source,
            trail_type: record.trail_type,
            skill_level: record.skill_level,
            date: record.date,
            time_slot: record.time_slot,
            duration_hours: record.duration_hours,
            location_id: record.location_id,
            location_name: record.location_name,
            bike_rental: record.bike_rental,
            rider_height_inches: record.rider_height_inches,
            participant_info: record.participant_info,
            addons: record.addons,
            total_price: record.total_price,
            payment_method: record.payment_method,
            admin_notes: record.admin_notes,
            customer_name: record.customer_name,
            customer_email: record.customer_email,
            customer_phone: record.customer_phone,
            discount_code: record.discount_code,
            discount_label: record.discount_label,
            remaining_balance_due_at: record.remaining_balance_due_at,
          }}
          locations={locations}
          backHref={back}
        />
      ) : (
        <EmptyState
          title={`Only a confirmed booking can be edited. This one is ${resolveStatus(BOOKING_STATUS, record.status).label.toLowerCase()}.`}
          hint="If the tour is on after all, set it back to confirmed under Manage on the booking first."
          action={
            <Link href={back} className={buttonClasses('secondary', 'md')}>
              Back to the booking
            </Link>
          }
        />
      )}
    </PageShell>
  );
}
