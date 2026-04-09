'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useBooking } from '@/context/BookingContext';
import { getActiveSteps } from '@/lib/steps';
import { cn } from '@/lib/utils';

export function BookingStepper() {
  const { state, currentStepId } = useBooking();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-full h-[72px]" />;
  }

  const activeSteps = getActiveSteps(state);
  const currentIndex = activeSteps.findIndex((step) => step.id === currentStepId);
  const progressPct =
    activeSteps.length > 1 ? (currentIndex / (activeSteps.length - 1)) * 100 : 0;

  return (
    <div className="w-full">
      <div className="mb-4 h-1.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-green-600 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex justify-between">
        {activeSteps.map((step, idx) => {
          const isCurrent = idx === currentIndex;
          const isComplete = idx < currentIndex;

          return (
            <div key={step.id} className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                  isComplete
                    ? 'border-green-600 bg-green-600 text-white'
                    : isCurrent
                      ? 'border-green-600 bg-background text-green-600'
                      : 'border-border bg-background text-muted-foreground'
                )}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'mt-1 hidden text-xs sm:block',
                  isCurrent ? 'font-medium text-green-600' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Step {currentIndex + 1} of {activeSteps.length}:{' '}
        <span className="font-medium text-foreground">{activeSteps[currentIndex]?.label}</span>
      </p>
    </div>
  );
}
