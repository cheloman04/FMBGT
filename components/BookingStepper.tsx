'use client';

import { useState, useEffect } from 'react';
import { useBooking } from '@/context/BookingContext';
import { getActiveSteps } from '@/lib/steps';
import { cn } from '@/lib/utils';

export function BookingStepper() {
  const { state, currentStepId } = useBooking();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-full h-[72px]" />;

  const activeSteps = getActiveSteps(state);
  const currentIndex = activeSteps.findIndex((s) => s.id === currentStepId);

  const progressPct =
    activeSteps.length > 1 ? (currentIndex / (activeSteps.length - 1)) * 100 : 0;

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full mb-4">
        <div
          className="h-full bg-green-600 rounded-full transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Step dots */}
      <div className="flex justify-between">
        {activeSteps.map((step, idx) => {
          const isCurrent = idx === currentIndex;
          const isComplete = idx < currentIndex;

          return (
            <div key={step.id} className="flex flex-col items-center">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors',
                  isComplete
                    ? 'bg-green-600 border-green-600 text-white'
                    : isCurrent
                    ? 'bg-background border-green-600 text-green-600'
                    : 'bg-background border-border text-muted-foreground'
                )}
              >
                {isComplete ? '✓' : idx + 1}
              </div>
              <span
                className={cn(
                  'text-xs mt-1 hidden sm:block',
                  isCurrent ? 'text-green-600 font-medium' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground mt-3">
        Step {currentIndex + 1} of {activeSteps.length}:{' '}
        <span className="font-medium text-foreground">{activeSteps[currentIndex]?.label}</span>
      </p>
    </div>
  );
}
