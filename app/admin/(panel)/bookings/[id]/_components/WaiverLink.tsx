'use client';

import { useState } from 'react';
import { Button, buttonClasses } from '@/components/kit';

// The booking's waiver link, while a rider still has to sign: the same link
// works as a kiosk on site (Open) or sent to the customer (Copy).
export function WaiverLink({ url }: { url: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Shown whole, so it can be long-pressed when the clipboard is blocked. */}
      <p className="break-all text-xs text-fg-muted">{url}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={copy}>
          Copy waiver link
        </Button>
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClasses('ghost', 'sm')}>
          Open kiosk
        </a>
        {copied !== null ? (
          <span role="status" className="text-xs text-fg-2">
            {copied ? 'Copied.' : 'The browser blocked the copy: select the link above.'}
          </span>
        ) : null}
      </div>
    </div>
  );
}
