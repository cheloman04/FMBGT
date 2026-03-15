'use client';

import { useEffect } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function BookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Booking flow error:', error);
  }, [error]);

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        We ran into an unexpected error. Your information has not been charged.
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={reset}
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Try Again
        </button>
        <Link href="/booking" className={cn(buttonVariants({ variant: 'default' }), 'bg-green-600 hover:bg-green-700 text-white')}>
          Start Over
        </Link>
      </div>
    </div>
  );
}
