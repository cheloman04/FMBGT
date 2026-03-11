'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const STEPS = [
  { step: 1, label: 'Trail Type', path: '/booking/step1-trail' },
  { step: 2, label: 'Skill Level', path: '/booking/step2-skill' },
  { step: 3, label: 'Location', path: '/booking/step3-location' },
  { step: 4, label: 'Bike', path: '/booking/step4-bike' },
  { step: 5, label: 'Date & Time', path: '/booking/step5-datetime' },
  { step: 6, label: 'Duration', path: '/booking/step6-duration' },
  { step: 7, label: 'Add-ons', path: '/booking/step7-addons' },
  { step: 8, label: 'Waiver', path: '/booking/step8-waiver' },
  { step: 9, label: 'Payment', path: '/booking/step9-payment' },
];

export function BookingStepper() {
  const pathname = usePathname();
  const currentStep = STEPS.find((s) => pathname.includes(s.path.split('/').pop()!));
  const currentStepNum = currentStep?.step ?? 1;

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200 rounded-full mb-4">
        <div
          className="h-full bg-green-600 rounded-full transition-all duration-300"
          style={{ width: `${((currentStepNum - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>

      {/* Step indicator */}
      <div className="flex justify-between">
        {STEPS.map(({ step, label }) => (
          <div key={step} className="flex flex-col items-center">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors',
                step < currentStepNum
                  ? 'bg-green-600 border-green-600 text-white'
                  : step === currentStepNum
                  ? 'bg-white border-green-600 text-green-600'
                  : 'bg-white border-gray-300 text-gray-400'
              )}
            >
              {step < currentStepNum ? '✓' : step}
            </div>
            <span
              className={cn(
                'text-xs mt-1 hidden sm:block',
                step === currentStepNum ? 'text-green-600 font-medium' : 'text-gray-400'
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-500 mt-3">
        Step {currentStepNum} of {STEPS.length}: <span className="font-medium text-gray-700">{currentStep?.label}</span>
      </p>
    </div>
  );
}
