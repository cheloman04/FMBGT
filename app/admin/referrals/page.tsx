import { requireAdminUser } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { AdminTopBar } from '../AdminTopBar';
import { ReferralsClient } from './ReferralsClient';

async function getReferralPartners() {
  const supabase = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('referral_partners')
    .select('id, partner_name, discount_code, discount_percentage, active, uses_count, notes, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/referrals] fetch error:', error.message);
    return [];
  }
  return data ?? [];
}

export default async function ReferralsPage() {
  await requireAdminUser();
  const partners = await getReferralPartners();

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <AdminTopBar
          activePage="referrals"
          title="Referrals"
          subtitle="Manage partner discount codes"
        />
        <ReferralsClient initialPartners={partners} />
      </div>
    </div>
  );
}
