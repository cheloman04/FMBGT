'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { RotateCcw } from 'lucide-react';
import { useBooking } from '@/context/BookingContext';
import { Button } from '@/components/ui/button';

export function BookingResetButton({ className }: { className?: string }) {
  const { reset } = useBooking();
  const [showResetDialog, setShowResetDialog] = useState(false);

  useEffect(() => {
    if (!showResetDialog) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowResetDialog(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showResetDialog]);

  const handleReset = () => {
    setShowResetDialog(false);
    reset();
  };

  return (
    <>
      {showResetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 animate-in fade-in-0 bg-black/75 backdrop-blur-md duration-200"
            onClick={() => setShowResetDialog(false)}
          />
          <div className="relative w-full max-w-lg animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 overflow-hidden rounded-3xl border border-green-500/25 bg-[linear-gradient(180deg,rgba(11,30,20,0.98)_0%,rgba(18,18,18,0.98)_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] duration-200">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.2),transparent_42%)]" />
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-green-400/70 to-transparent" />

            <div className="relative px-6 pb-6 pt-5 sm:px-7">
              <div className="mb-5 flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-green-400/25 bg-white/95 shadow-[0_10px_30px_rgba(34,197,94,0.18)]">
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/60" />
                  <Image
                    src="/images/branding/logo-fmtbg.png"
                    alt="Florida Mountain Bike Trail Guided Tours"
                    width={44}
                    height={44}
                    className="relative h-11 w-11 object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 inline-flex rounded-full border border-green-500/25 bg-green-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-green-400">
                    Booking Reset
                  </div>
                  <p className="text-sm font-semibold text-foreground sm:text-[15px]">
                    Florida Mountain Bike Trail Guided Tours
                  </p>
                  <p className="text-xs text-muted-foreground">Secure Booking Experience</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    Start a new booking?
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    We&apos;ll clear your current selections and bring you back to step 1 so you can begin with a fresh booking flow.
                  </p>
                </div>

                <div className="grid gap-3 rounded-2xl border border-green-500/18 bg-white/[0.03] p-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/6 bg-black/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-400">Will be cleared</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Riders, bike choices, date and time, totals, waiver progress, and payment step data.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-black/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-400">Fresh restart</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Best option if you want to change plans, trail type, or begin a brand-new reservation.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 px-4 py-3">
                  <p className="text-sm text-foreground">
                    Your current booking is not submitted yet. This only resets the in-progress flow.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowResetDialog(false)}
                    className="w-full border-white/12 bg-white/[0.03] sm:w-auto"
                  >
                    Keep Current Booking
                  </Button>
                  <Button
                    type="button"
                    onClick={handleReset}
                    className="w-full bg-green-600 text-white shadow-[0_12px_30px_rgba(22,163,74,0.28)] hover:bg-green-700 sm:w-auto"
                  >
                    Start New Booking
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowResetDialog(true)}
        className={className}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Start New Booking</span>
      </Button>
    </>
  );
}
