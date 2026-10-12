'use client';

import { useEffect } from 'react';
import { Button, PageHeader, PageShell } from '@/components/kit';

// A page of the panel threw while rendering. The shell stays up, so the
// operator can retry or go somewhere else from the menu (§8.5).
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[admin] page failed to render:', error);
  }, [error]);

  return (
    <PageShell>
      <PageHeader
        title="This page didn't load"
        subtitle="Nothing was changed. Try again, or open another page from the menu."
        actions={
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
        }
      />
      {error.digest ? <p className="text-xs text-fg-muted">Reference: {error.digest}</p> : null}
    </PageShell>
  );
}
