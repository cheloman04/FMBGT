'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonClasses } from '@/components/kit';

// A manual booking's waiver link, from its row: copy it to send, or open it as
// the kiosk on site. The link itself (to long-press when the clipboard is
// blocked) is on the booking's page.
export function WaiverActions({ url, bookingHref }: { url: string; bookingHref: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  // `@2xl:` is the list's width, where it turns into a table (`tableFrom="md"` on
  // the page). In the rows the list gives this a whole line
  // (`mobileActions="fill"`): two halves. In the table, side by side on the right.
  return (
    <>
      {/* Outside the end-aligned column: there the 1px sr-only box sat past the
          cell's right edge, and the table grew a scrollbar. */}
      {copied ? (
        <span role="status" className="sr-only">
          Waiver link copied.
        </span>
      ) : null}
      <div className="flex flex-col gap-1.5 @2xl:items-end">
        <div className="grid grid-cols-2 gap-2 whitespace-nowrap @2xl:flex @2xl:justify-end">
          <Button size="sm" variant="secondary" onClick={copy}>
            {copied ? 'Copied' : 'Copy waiver link'}
          </Button>
          <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClasses('secondary', 'sm')}>
            Open kiosk
          </a>
        </div>
        {copied === false ? (
          <p role="status" className="text-xs text-fg-2 @2xl:max-w-64 @2xl:text-right">
            The browser blocked the copy:{' '}
            <Link href={bookingHref} className="underline underline-offset-2">
              the booking’s page
            </Link>{' '}
            shows the link to select.
          </p>
        ) : null}
      </div>
    </>
  );
}
