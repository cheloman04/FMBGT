import type { ReactNode } from 'react';
import { ProgressBar, Section, StatusBadge } from '@/components/kit';
import type { Fact } from '@/lib/admin/bookings';
import type { LeadDetailView } from '@/lib/admin/leads';
import { DeleteLead, SendFollowUp } from './LeadActions';

const LINK = 'text-fg underline decoration-hairline underline-offset-4 hover:decoration-fg-muted';

/** Label on the left, value on the right. */
function Facts({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-sm">
      {facts.map((f) => (
        <div key={f.label} className="contents">
          <dt className="text-fg-muted">{f.label}</dt>
          <dd className="break-words text-fg">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FactsOr({ facts, empty }: { facts: Fact[]; empty: string }) {
  return facts.length ? <Facts facts={facts} /> : <p className="text-sm text-fg-muted">{empty}</p>;
}

/**
 * The quick view of one lead in the list's drawer (?lead=<id>): what the old
 * expandable row showed, with the follow-up and delete actions where they apply.
 */
export function LeadQuickView({ lead, closeHref }: { lead: LeadDetailView; closeHref: string }) {
  const contact: { label: string; value: ReactNode }[] = [
    {
      label: 'Email',
      value: (
        <a href={`mailto:${lead.contact.email}`} className={LINK}>
          {lead.contact.email}
        </a>
      ),
    },
    {
      label: 'Phone',
      value: lead.contact.phone ? (
        <a href={`tel:${lead.contact.phone}`} className={LINK}>
          {lead.contact.phone}
        </a>
      ) : (
        '—'
      ),
    },
    ...lead.contact.facts,
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge meta={lead.followUp.meta} />
        {lead.freshness ? <StatusBadge meta={lead.freshness} /> : null}
      </div>

      <Section title="Contact">
        <Facts facts={contact} />
      </Section>

      <Section title="What they were booking">
        <FactsOr facts={lead.intent} empty="Only contact details so far." />
      </Section>

      <Section title="Booking progress">
        <ProgressBar value={lead.progress.percent} label="Booking progress" />
        <p className="mt-2 text-xs text-fg-muted">
          {lead.progress.percent}% · {lead.progress.label}
        </p>
      </Section>

      <Section title="Follow-up" subtitle={lead.followUp.detail || undefined}>
        <Facts facts={lead.followUp.facts} />
        {lead.followUp.emails.length ? (
          <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
            {lead.followUp.emails.map((email) => (
              <li key={email.key} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-fg-2">{email.label}</p>
                  {email.when ? <p className="text-xs text-fg-muted">{email.when}</p> : null}
                </div>
                <StatusBadge meta={email.meta} size="sm" />
              </li>
            ))}
          </ul>
        ) : null}
        {lead.sendFollowUp ? (
          <div className="mt-4">
            <SendFollowUp leadId={lead.id} name={lead.name} to={lead.sendFollowUp.to} />
          </div>
        ) : null}
      </Section>

      <Section title="Attribution">
        <FactsOr facts={lead.attribution} empty="No campaign data: they came in without UTM tags." />
      </Section>

      <Section title="Manage">
        <DeleteLead leadId={lead.id} name={lead.name} closeHref={closeHref} />
      </Section>
    </div>
  );
}
