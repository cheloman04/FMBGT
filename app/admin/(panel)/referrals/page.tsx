import { MetricStrip, PageHeader, PageShell, ResponsiveList, Section, StatusBadge, type Column } from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { loadReferralPartners } from '@/lib/admin/loaders';
import { partnerRows, referralMetrics, type PartnerRow } from '@/lib/admin/referrals';
import { CopyCode } from '../_components/CopyCode';
import { AddPartnerForm } from './_components/AddPartnerForm';
import { PartnerActions } from './_components/PartnerActions';

export const metadata = { title: 'Referrals | Admin' };
export const dynamic = 'force-dynamic';

const COLUMNS: Column<PartnerRow>[] = [
  { key: 'partner', header: 'Partner', cell: (r) => r.partner },
  { key: 'code', header: 'Code', cell: (r) => <CopyCode code={r.code} />, mobile: 'secondary', interactive: true },
  { key: 'discount', header: 'Discount', cell: (r) => r.discount, align: 'right', width: 'w-24' },
  { key: 'uses', header: 'Uses', cell: (r) => r.uses, align: 'right', width: 'w-20' },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge meta={r.statusMeta} size="sm" />, mobile: 'status', width: 'w-36' },
  { key: 'notes', header: 'Notes', cell: (r) => (r.notes ? <span className="line-clamp-2 text-xs text-fg-muted">{r.notes}</span> : null), mobile: 'hidden' },
  {
    key: 'actions',
    header: '',
    cell: (r) => (r.builtIn ? null : <PartnerActions id={r.id} code={r.code} active={r.active} />),
    align: 'right',
    mobile: 'actions',
    interactive: true,
  },
];

export default async function ReferralsPage() {
  await requireOperator();
  const partners = await loadReferralPartners();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Promotions"
        title="Referrals"
        subtitle="Discount codes for partner businesses. Customers enter them at checkout."
      />
      <MetricStrip metrics={referralMetrics(partners)} />

      <div className="mt-10 space-y-10">
        <Section title="Discount codes" subtitle="Friends & family is built into checkout; partner codes are yours to manage.">
          <ResponsiveList rows={partnerRows(partners)} columns={COLUMNS} rowKey={(r) => r.id} caption="Discount codes" />
        </Section>

        <Section title="Add a partner">
          <AddPartnerForm />
        </Section>
      </div>
    </PageShell>
  );
}
