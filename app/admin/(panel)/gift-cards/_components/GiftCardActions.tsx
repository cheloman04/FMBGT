'use client';

import { Button, useAction, useConfirm } from '@/components/kit';
import { api } from '@/lib/admin/api';
import type { GiftCardStatus } from '@/lib/admin/status-meta';

// Void an active card; delete a void one. Reserved cards are mid-checkout and
// redeemed ones are history: neither has an action.
export function GiftCardActions({ id, code, status }: { id: string; code: string; status: GiftCardStatus }) {
  const { confirm, dialog } = useConfirm();
  const voidCard = useAction(() => api.patch('/api/admin/gift-cards', { id, status: 'void' }));
  const remove = useAction(() => api.delete('/api/admin/gift-cards', { id }));

  if (status !== 'active' && status !== 'void') return null;

  async function onVoid() {
    const ok = await confirm({
      title: `Void ${code}?`,
      description: "It stops working at checkout right away. This can't be undone.",
      confirmLabel: 'Void card',
      danger: true,
    });
    if (ok) await voidCard.run();
  }

  async function onDelete() {
    const ok = await confirm({
      title: `Delete ${code}?`,
      description: 'The void card is removed from this list for good.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) await remove.run();
  }

  const error = voidCard.error ?? remove.error;
  return (
    <div className="flex flex-col items-end gap-1">
      {status === 'active' ? (
        <Button size="sm" variant="secondary" loading={voidCard.pending} onClick={onVoid}>
          Void
        </Button>
      ) : (
        <Button size="sm" variant="ghost" loading={remove.pending} onClick={onDelete}>
          Delete
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-xs text-tone-red">
          {error}
        </p>
      ) : null}
      {/* The kit's Modal renders in place and inherits the right-aligned cell's
          text-align; reset it until the kit sets text-left itself. */}
      <div className="text-left">{dialog}</div>
    </div>
  );
}
