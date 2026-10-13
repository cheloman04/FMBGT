// Referral partners in the admin: the DB record, the rows of the codes list
// (the hardcoded friends & family code first) and the metric strip. Pure.
import type { Metric, StatusMeta } from '@/components/kit';
import { FAM_CODE, FAM_PERCENTAGE } from '@/lib/discounts';
import { PARTNER_STATUS } from './status-meta';

export type ReferralPartnerRecord = {
  id: string;
  partner_name: string;
  discount_code: string;
  discount_percentage: number;
  active: boolean;
  uses_count: number;
  notes: string | null;
  created_at: string;
};

export type PartnerRow = {
  id: string;
  partner: string;
  code: string;
  discount: string;
  /** null for the friends & family code: its uses aren't counted. */
  uses: number | null;
  active: boolean;
  /** The hardcoded code: listed for reference, no actions. */
  builtIn: boolean;
  statusMeta: StatusMeta;
  notes: string | null;
};

export const FAMILY_ROW: PartnerRow = {
  id: 'built-in-fam',
  partner: 'Friends & family',
  code: FAM_CODE,
  discount: `${FAM_PERCENTAGE}%`,
  uses: null,
  active: true,
  builtIn: true,
  statusMeta: PARTNER_STATUS.builtIn,
  notes: 'Hardcoded at checkout',
};

export function partnerRows(partners: readonly ReferralPartnerRecord[]): PartnerRow[] {
  return [
    FAMILY_ROW,
    ...partners.map((p) => ({
      id: p.id,
      partner: p.partner_name,
      code: p.discount_code,
      discount: `${p.discount_percentage}%`,
      uses: p.uses_count,
      active: p.active,
      builtIn: false,
      statusMeta: p.active ? PARTNER_STATUS.active : PARTNER_STATUS.inactive,
      notes: p.notes,
    })),
  ];
}

export function referralMetrics(partners: readonly ReferralPartnerRecord[]): Metric[] {
  const active = partners.filter((p) => p.active);
  const uses = partners.reduce((total, p) => total + p.uses_count, 0);
  const top = partners.reduce<ReferralPartnerRecord | null>(
    (best, p) => (p.uses_count > 0 && (!best || p.uses_count > best.uses_count) ? p : best),
    null,
  );
  return [
    {
      key: 'active',
      label: 'Active partner codes',
      labelShort: 'Active codes',
      value: String(active.length),
      sub: `${partners.length - active.length} inactive`,
    },
    {
      key: 'uses',
      label: 'Partner code uses',
      labelShort: 'Code uses',
      value: String(uses),
      // A name is a phrase, not a figure: it goes under the number, not as one.
      sub: top ? `Most: ${top.partner_name} (${top.uses_count})` : 'No partner code used yet',
    },
  ];
}
