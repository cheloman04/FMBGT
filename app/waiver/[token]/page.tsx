import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { WaiverSignClient } from './WaiverSignClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign Your Waiver — Florida Mountain Bike Guided Tours',
  robots: { index: false, follow: false },
};

export default async function WaiverTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking } = await (supabase as any)
    .from('bookings')
    .select(
      'id, trail_type, date, time_slot, status, waiver_accepted, participant_count, participant_info, ' +
        'customers(name, email), locations(name)'
    )
    .eq('waiver_link_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (!booking) notFound();

  const customer = (booking.customers ?? null) as { name?: string; email?: string } | null;
  const locationName = (booking.locations as { name?: string } | null)?.name ?? null;
  const additional = (booking.participant_info ?? []) as Array<{ name?: string }>;

  const participantNames = [
    customer?.name?.trim() || 'Rider 1',
    ...additional.map((p) => p?.name?.trim()).filter((n): n is string => Boolean(n)),
  ];

  return (
    <WaiverSignClient
      token={token}
      alreadySigned={Boolean(booking.waiver_accepted)}
      cancelled={booking.status === 'cancelled' || booking.status === 'refunded'}
      customerEmail={customer?.email ?? undefined}
      participantNames={participantNames}
      context={{
        trailType: booking.trail_type ?? undefined,
        locationName: locationName ?? undefined,
        tourDate: booking.date ?? undefined,
        timeSlot: booking.time_slot ?? undefined,
        bookingRef: booking.id,
      }}
    />
  );
}
