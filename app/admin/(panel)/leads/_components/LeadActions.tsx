'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button, useAction, useConfirm } from '@/components/kit';
import { api } from '@/lib/admin/api';

// The lead drawer's actions, one island each with its own pending state and
// its error next to it (§8.5). Through lib/admin/api.ts (a stale session goes to
// the login page) and useAction (router.refresh() repaints the drawer: the new
// follow-up status is the success message).

function Action({ children, error }: { children: ReactNode; error: string | null }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      {children}
      {error ? (
        <p role="alert" className="text-xs text-tone-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Enroll the lead in the follow-up sequence (/api/admin/send-lead-follow-up):
 * lib/lead-followup.ts schedules three emails, an hour, a day and a week out,
 * and cancels them if the lead books.
 */
export function SendFollowUp({ leadId, name, to }: { leadId: string; name: string; to: string }) {
  const { confirm, dialog } = useConfirm();
  const send = useAction(() => api.post('/api/admin/send-lead-follow-up', { lead_id: leadId }));

  async function onClick() {
    const ok = await confirm({
      title: `Start the follow-up for ${name}?`,
      description: `Three emails go to ${to}: in an hour, in a day and in a week. They stop if ${name} books.`,
      confirmLabel: 'Start follow-up',
    });
    if (ok) await send.run();
  }

  return (
    <Action error={send.error}>
      <Button size="sm" variant="secondary" loading={send.pending} onClick={onClick}>
        Start follow-up
      </Button>
      {dialog}
    </Action>
  );
}

/**
 * /api/admin/delete-lead deletes the lead with its follow-up, its unpaid
 * checkouts and their waivers, or archives it (Trash) when one of its bookings
 * has a payment. Either way it leaves this list, so the drawer closes onto it.
 */
export function DeleteLead({ leadId, name, closeHref }: { leadId: string; name: string; closeHref: string }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const remove = useAction(() => api.post('/api/admin/delete-lead', { lead_id: leadId }), {
    badges: true,
    // The list it lands on is rendered fresh; nothing to refresh here.
    refresh: false,
    onSuccess: () => router.replace(closeHref, { scroll: false }),
  });

  async function onClick() {
    const ok = await confirm({
      title: `Delete ${name}?`,
      description:
        'The lead, its follow-up and its unpaid checkouts are deleted for good. If one of its bookings has a payment, the lead goes to the Trash instead.',
      confirmLabel: 'Delete lead',
      danger: true,
    });
    if (ok) await remove.run();
  }

  return (
    <Action error={remove.error}>
      <Button size="sm" variant="danger" loading={remove.pending} onClick={onClick}>
        Delete lead
      </Button>
      {dialog}
    </Action>
  );
}
