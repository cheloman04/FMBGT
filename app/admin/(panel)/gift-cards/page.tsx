import {
  EmptyState,
  MetricStrip,
  PageHeader,
  PageShell,
  ResponsiveList,
  Section,
  StatusBadge,
  type Column,
} from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { giftCardMetrics, toGiftCardRow, type GiftCardRow } from '@/lib/admin/gift-cards';
import { loadGiftCards } from '@/lib/admin/loaders';
import { CopyCode } from '../_components/CopyCode';
import { GiftCardActions } from './_components/GiftCardActions';
import { MintGiftCardForm } from './_components/MintGiftCardForm';

export const metadata = { title: 'Gift cards | Admin' };
export const dynamic = 'force-dynamic';

const COLUMNS: Column<GiftCardRow>[] = [
  { key: 'code', header: 'Code', cell: (r) => <CopyCode code={r.code} />, interactive: true },
  { key: 'amount', header: 'Amount', cell: (r) => <span className="font-semibold text-fg">{r.amount}</span>, align: 'right', mobile: 'secondary', width: 'w-28' },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge meta={r.statusMeta} size="sm" />, mobile: 'status', width: 'w-32' },
  { key: 'recipient', header: 'Recipient', cell: (r) => r.recipient },
  { key: 'issued', header: 'Issued', cell: (r) => r.issued, width: 'w-32' },
  // Desktop only: on a phone the badge already says "Redeemed", and an unredeemed
  // card would end its meta line with a lone dash.
  { key: 'redeemed', header: 'Redeemed', cell: (r) => r.redeemed ?? '—', mobile: 'hidden' },
  {
    key: 'actions',
    header: '',
    cell: (r) => <GiftCardActions id={r.id} code={r.code} status={r.status} />,
    align: 'right',
    mobile: 'actions',
    interactive: true,
  },
];

export default async function GiftCardsPage() {
  await requireOperator();
  const cards = await loadGiftCards();
  const rows = cards.map(toGiftCardRow);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Promotions"
        title="Gift cards"
        subtitle="Fixed amount, single use, never expire. Each one is a code the recipient enters at checkout."
      />
      <MetricStrip metrics={giftCardMetrics(cards)} heaviest="outstanding" />

      <div className="mt-10 space-y-10">
        <Section title="Mint a gift card" subtitle="A unique code is generated for you. Share it with the recipient; it works once, for up to its amount.">
          <MintGiftCardForm />
        </Section>

        <Section title="Issued gift cards">
          <ResponsiveList
            rows={rows}
            columns={COLUMNS}
            rowKey={(r) => r.id}
            caption="Issued gift cards"
            empty={<EmptyState title="No gift cards yet. The ones you mint above appear here." />}
          />
        </Section>
      </div>
    </PageShell>
  );
}
