'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BookingStepper } from '@/components/BookingStepper';
import { useBooking } from '@/context/BookingContext';

export function BookingFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { reset } = useBooking();
  const [ready, setReady] = useState(pathname !== '/booking');

  useEffect(() => {
    if (pathname !== '/booking') {
      setReady(true);
      return;
    }

    setReady(false);
    reset();
    setReady(true);
  }, [pathname, reset]);

  if (!ready) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-[120px] w-full" />
        <div className="mt-6 min-h-[400px]" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <BookingStepper />
      <div className="mt-6">{children}</div>
    </main>
  );
}
