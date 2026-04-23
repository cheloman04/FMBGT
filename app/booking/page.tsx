'use client';

import { useState, useEffect, useRef } from 'react';
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
import { track, captureAcquisitionContext } from '@/lib/analytics';
import { getActiveSteps } from '@/lib/steps';
import type { StepId } from '@/lib/steps';
import type { ComponentType } from 'react';
import { extractAttributionFromSearchParams, pickUtmFromAttribution } from '@/lib/attribution';

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

const SESSION_ACTIVITY_PING_MS = 30_000;
const SESSION_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const EXIT_TRACKING_ARM_DELAY_MS = 1_500;

export default function BookingPage() {
  const { currentStepId, state, setLeadSessionId, setLiveTestMode, setUtm, captureAttribution } = useBooking();
  const [mounted, setMounted] = useState(false);
  const exitTrackingArmedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const attribution = extractAttributionFromSearchParams(params);
    const liveTestRequested = params.get('live_test') === '1';
    const liveTestToken = params.get('test_token')?.trim() || undefined;
    setLiveTestMode(liveTestRequested, liveTestToken);
    if (attribution) {
      captureAttribution(attribution);
      setUtm(pickUtmFromAttribution(attribution));
    }
  }, [captureAttribution, setLiveTestMode, setUtm]);

  // Fire booking_started + initial booking_step_view once on mount (Blueprint §12.3).
  // captureAcquisitionContext() is idempotent — safe to call alongside captureAttribution().
  useEffect(() => {
    if (!mounted) return;
    const acq = captureAcquisitionContext();
    track('booking_started', {
      booking_step_name: currentStepId,
      trail_type: state.trail_type,
      traffic_source: acq.traffic_source,
      traffic_medium: acq.traffic_medium,
      utm_campaign: acq.utm_campaign,
      referrer: acq.referrer,
    });
    const activeSteps = getActiveSteps(state);
    const stepIndex = activeSteps.findIndex((s) => s.id === currentStepId);
    track('booking_step_view', {
      booking_step_name: currentStepId,
      booking_step_number: stepIndex + 1,
      trail_type: state.trail_type,
      traffic_source: acq.traffic_source,
      traffic_medium: acq.traffic_medium,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !state.lead_id) return;

    let cancelled = false;

    const ensureSession = async () => {
      try {
        const res = await fetch(`/api/leads/${state.lead_id}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_session_id: state.lead_session_id ?? null,
          }),
        });

        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.session_id && data.session_id !== state.lead_session_id) {
          setLeadSessionId(data.session_id);
        }
      } catch {
        // Best-effort only; the booking flow should keep working
      }
    };

    void ensureSession();

    return () => {
      cancelled = true;
    };
  }, [mounted, state.lead_id, state.lead_session_id, setLeadSessionId]);

  useEffect(() => {
    if (!mounted || !state.lead_id || !state.lead_session_id) return;

    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    let abandonSignaled = false;

    const abandonUrl = `/api/leads/${state.lead_id}/abandon`;

    const ensureFreshSession = async () => {
      try {
        const res = await fetch(`/api/leads/${state.lead_id}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_session_id: state.lead_session_id,
          }),
        });

        if (!res.ok) return;
        const data = await res.json();
        if (data.session_id && data.session_id !== state.lead_session_id) {
          abandonSignaled = false;
          setLeadSessionId(data.session_id);
        }
      } catch {
        // Ignore session recovery failures
      }
    };

    const sendAbandonSignal = (reason: 'page_exit' | 'inactivity_timeout') => {
      if (abandonSignaled) return;
      abandonSignaled = true;

      const payload = JSON.stringify({
        session_id: state.lead_session_id,
        reason,
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          abandonUrl,
          new Blob([payload], { type: 'application/json' })
        );
        return;
      }

      fetch(abandonUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    };

    const touchSession = () => {
      fetch(`/api/leads/${state.lead_id}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: state.lead_session_id,
        }),
      }).catch(() => {});
    };

    const scheduleHeartbeat = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(() => {
        touchSession();
        scheduleHeartbeat();
      }, SESSION_ACTIVITY_PING_MS);
    };

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        sendAbandonSignal('inactivity_timeout');
      }, SESSION_INACTIVITY_TIMEOUT_MS);
    };

    const handleInteraction = () => {
      if (abandonSignaled) {
        void ensureFreshSession();
        return;
      }
      resetInactivityTimer();
      scheduleHeartbeat();
    };

    const handlePageHide = () => {
      sendAbandonSignal('page_exit');
    };

    const armTimer = setTimeout(() => {
      exitTrackingArmedRef.current = true;
    }, EXIT_TRACKING_ARM_DELAY_MS);

    resetInactivityTimer();
    scheduleHeartbeat();

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pointerdown', handleInteraction, { passive: true });
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('scroll', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });

    return () => {
      clearTimeout(armTimer);
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      if (inactivityTimer) clearTimeout(inactivityTimer);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);

      if (exitTrackingArmedRef.current) {
        sendAbandonSignal('page_exit');
      }
      exitTrackingArmedRef.current = false;
    };
  }, [mounted, setLeadSessionId, state.lead_id, state.lead_session_id]);

  if (!mounted) return <div className="min-h-[400px]" />;

  const StepComponent = STEP_COMPONENTS[currentStepId];
  return (
    <>
      {state.live_test_mode && (
        <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Internal live payment verification mode. Use this flow only for real Stripe end-to-end testing.
        </div>
      )}
      <StepComponent />
    </>
  );
}
