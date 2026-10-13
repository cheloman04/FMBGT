'use client';

import { useState } from 'react';

/**
 * A code the operator hands to someone (a gift card, a partner discount code):
 * monospace, one tap copies it. The confirmation is inline, next to it (D5).
 */
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // No clipboard (insecure context, denied): the code is on screen to select by hand.
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        title="Copy code"
        className="rounded font-mono text-sm text-fg decoration-fg-muted underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60"
      >
        {code}
      </button>
      {copied ? (
        <span role="status" className="text-xs text-fg-muted">
          Copied
        </span>
      ) : null}
    </span>
  );
}
