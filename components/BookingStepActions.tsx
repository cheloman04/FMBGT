'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookingResetButton } from '@/components/BookingResetButton';

export function BookingStepActions({
  onBack,
  backVariant = 'outline',
}: {
  onBack?: () => void;
  backVariant?: 'outline' | 'ghost';
}) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3">
      {onBack ? (
        <Button
          variant={backVariant}
          onClick={onBack}
          className="justify-start gap-1.5 border-border text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back</span>
        </Button>
      ) : (
        <div />
      )}

      <BookingResetButton className="w-full justify-center gap-1.5" />
    </div>
  );
}
