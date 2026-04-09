'use client';

import { useState, useEffect } from 'react';
import { useBooking } from '@/context/BookingContext';
import { StepTrail } from '@/components/steps/StepTrail';
import { StepLeadCapture } from '@/components/steps/StepLeadCapture';
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
  lead_capture: StepLeadCapture,
  skill: StepSkill,
  location: StepLocation,
  bike: StepBike,
  datetime: StepDateTime,
  duration: StepDuration,
  addons: StepAddons,
  waiver: StepWaiver,
  payment: StepPayment,
};

// UTM params to capture silently from the URL
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export default function BookingPage() {
  const { currentStepId, state, setUtm } = useBooking();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Capture UTM params from the URL on first entry, but only if not already stored
    const hasUtm = state.utm_source || state.utm_medium || state.utm_campaign;
    if (!hasUtm) {
      const params = new URLSearchParams(window.location.search);
      const utmValues: Record<string, string | undefined> = {};
      let found = false;
      for (const key of UTM_PARAMS) {
        const val = params.get(key);
        if (val) {
          utmValues[key] = val;
          found = true;
        }
      }
      if (found) {
        setUtm(utmValues as Parameters<typeof setUtm>[0]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  if (!mounted) return <div className="min-h-[400px]" />;
  const StepComponent = STEP_COMPONENTS[currentStepId];
  return <StepComponent />;
}
