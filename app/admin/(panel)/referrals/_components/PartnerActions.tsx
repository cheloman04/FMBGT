'use client';

import { Button, useAction, useConfirm } from '@/components/kit';
import { api } from '@/lib/admin/api';

// Activate or deactivate a partner code; delete it once it's inactive (the API
// refuses to delete an active one, so the button isn't offered).
export function PartnerActions({ id, code, active }: { id: string; code: string; active: boolean }) {
  const { confirm, dialog } = useConfirm();
  const toggle = useAction(() => api.patch('/api/admin/referral-partners', { id, active: !active }));
  const remove = useAction(() => api.delete('/api/admin/referral-partners', { id }));

  async function onToggle() {
    if (active) {
      const ok = await confirm({
        title: `Deactivate ${code}?`,
        description: 'Customers who enter it at checkout get no discount until you activate it again.',
        confirmLabel: 'Deactivate',
      });
      if (!ok) return;
    }
    await toggle.run();
  }

  async function onDelete() {
    const ok = await confirm({
      title: `Delete ${code}?`,
      description: 'The partner and its code are removed for good. Bookings that used it keep their discount.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) await remove.run();
  }

  const error = toggle.error ?? remove.error;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" loading={toggle.pending} onClick={onToggle}>
          {active ? 'Deactivate' : 'Activate'}
        </Button>
        {!active ? (
          <Button size="sm" variant="ghost" loading={remove.pending} onClick={onDelete}>
            Delete
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-tone-red">
          {error}
        </p>
      ) : null}
      {dialog}
    </div>
  );
}
