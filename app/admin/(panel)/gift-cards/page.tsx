import { requireAdminUser } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { PageHeader } from '@/components/kit';
import { LegacyArea } from '../../_components/LegacyArea';
import { GiftCardsClient } from './GiftCardsClient';

async function getGiftCards() {
  const supabase = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('gift_cards')
    .select(
      'id, code, amount_cents, status, recipient_name, recipient_email, purchaser_name, notes, ' +
        'reserved_booking_id, redeemed_booking_id, redeemed_amount_cents, redeemed_at, created_by, created_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/gift-cards] fetch error:', error.message);
    return [];
  }
  return data ?? [];
}

export default async function GiftCardsPage() {
  await requireAdminUser();
  const giftCards = await getGiftCards();

  return (
    <LegacyArea>
      <div className="bg-background p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <PageHeader title="Gift cards" subtitle="Mint and manage fixed-amount gift cards" />
          <GiftCardsClient initialGiftCards={giftCards} />
        </div>
      </div>
    </LegacyArea>
  );
}
