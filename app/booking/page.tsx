'use client';

import { useState, useEffect } from 'react';
import { useBooking } from '@/context/BookingContext';
import { StepTrail } from '@/components/steps/StepTrail';
import { StepSkill } from '@/components/steps/StepSkill';
import { StepLocation } from '@/components/steps/StepLocation';
import { StepBike } from '@/components/steps/StepBike';
import { StepDateTime } from '@/components/steps/StepDateTime';
import { StepDuration } from '@/components/steps/StepDuration';
import { StepAddons } from '@/components/steps/StepAddons';
import { StepWaiver } from '@/components/steps/StepWaiver';
import { StepPayment } from '@/components/steps/StepPayment';
import type { StepId } from '@/lib/steps';
import type { ComponentType } from 'react';

const STEP_COMPONENTS: Record<StepId, ComponentType> = {
  trail: StepTrail,
  skill: StepSkill,
  location: StepLocation,
  bike: StepBike,
  datetime: StepDateTime,
  duration: StepDuration,
  addons: StepAddons,
  waiver: StepWaiver,
  payment: StepPayment,
};

export default function BookingPage() {
  const { currentStepId } = useBooking();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="min-h-[400px]" />;
  const StepComponent = STEP_COMPONENTS[currentStepId];
  return <StepComponent />;
}
