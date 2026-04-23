'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { track } from '@/lib/analytics';
import type {
  BookingState,
  TrailType,
  SkillLevel,
  BikeRental,
  Addons,
  DurationHours,
  Customer,
  PriceBreakdown,
  AdditionalParticipant,
  WaiverParticipant,
  WaiverSigner,
  AttributionPayload,
} from '@/types/booking';
import {
  DEFAULT_STEP_ID,
  getActiveSteps,
  getNextStepId,
  getPrevStepId,
  isStepActive,
  type StepId,
} from '@/lib/steps';

// ─── Persistence ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'fmtg_booking_v1';

type Persisted = {
  booking: Omit<BookingState, 'price_breakdown'>;
  stepId: StepId;
};

function loadPersisted(): Persisted {
  if (typeof window === 'undefined') return { booking: {}, stepId: DEFAULT_STEP_ID };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : { booking: {}, stepId: DEFAULT_STEP_ID };
  } catch {
    return { booking: {}, stepId: DEFAULT_STEP_ID };
  }
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

type BookingAction =
  | { type: 'SET_TRAIL_TYPE'; payload: TrailType }
  | { type: 'SET_SKILL_LEVEL'; payload: SkillLevel }
  | { type: 'SET_LOCATION'; payload: { id: string; name: string } }
  | { type: 'SET_BIKE_RENTAL'; payload: BikeRental }
  | { type: 'SET_RIDER_HEIGHT'; payload: number }
  | { type: 'SET_DATE'; payload: string }
  | { type: 'SET_TIME_SLOT'; payload: string }
  | { type: 'SET_DURATION'; payload: DurationHours }
  | { type: 'SET_ADDONS'; payload: Addons }
  | { type: 'SET_WAIVER_ACCEPTED'; payload: boolean }
  | { type: 'SET_WAIVER_PARTICIPANTS'; payload: WaiverParticipant[] }
  | { type: 'SET_WAIVER_SIGNERS'; payload: WaiverSigner[] }
  | { type: 'SET_WAIVER_SESSION_ID'; payload: string }
  | { type: 'SET_CUSTOMER'; payload: Customer }
  | { type: 'SET_PRICE_BREAKDOWN'; payload: PriceBreakdown }
  | { type: 'SET_PARTICIPANTS'; payload: { count: number; additional: AdditionalParticipant[] } }
  | { type: 'SET_BOOKING_ID'; payload: string }
  | { type: 'SET_LEAD_ID'; payload: string }
  | { type: 'SET_LEAD_SESSION_ID'; payload: string }
  | { type: 'SET_LIVE_TEST_MODE'; payload: { enabled: boolean; token?: string } }
  | { type: 'SET_UTM'; payload: { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string } }
  | { type: 'SET_ATTRIBUTION'; payload: { first_touch?: AttributionPayload; last_touch: AttributionPayload } }
  | { type: 'RESET' };

function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'SET_TRAIL_TYPE':
      // Changing trail type resets all downstream selections.
      // For paved: bike is always included (standard) and duration is fixed at 2hrs.
      const preservedTestMode = {
        live_test_mode: state.live_test_mode,
        live_test_token: state.live_test_token,
      };
      if (action.payload === 'paved') {
        return {
          ...preservedTestMode,
          trail_type: action.payload,
          bike_rental: 'standard',
          duration_hours: 2,
        };
      }
      return {
        ...preservedTestMode,
        trail_type: action.payload,
      };

    case 'SET_SKILL_LEVEL':
      return {
        ...state,
        skill_level: action.payload,
        location_id: undefined,
        location_name: undefined,
        // First-time riders are locked to 2-hour tours; clear any prior duration choice for others
        duration_hours: action.payload === 'first_time' ? 2 : undefined,
      };

    case 'SET_LOCATION':
      return {
        ...state,
        location_id: action.payload.id,
        location_name: action.payload.name,
      };

    case 'SET_BIKE_RENTAL':
      return {
        ...state,
        bike_rental: action.payload,
        rider_height_inches: action.payload === 'none' ? undefined : state.rider_height_inches,
      };

    case 'SET_RIDER_HEIGHT':
      return { ...state, rider_height_inches: action.payload };

    case 'SET_DATE':
      return { ...state, date: action.payload, time_slot: undefined };

    case 'SET_TIME_SLOT':
      return { ...state, time_slot: action.payload };

    case 'SET_DURATION':
      return { ...state, duration_hours: action.payload };

    case 'SET_ADDONS':
      return { ...state, addons: action.payload };

    case 'SET_WAIVER_ACCEPTED':
      return { ...state, waiver_accepted: action.payload };

    case 'SET_WAIVER_PARTICIPANTS':
      return { ...state, waiver_participants: action.payload };

    case 'SET_WAIVER_SIGNERS':
      return { ...state, waiver_signers: action.payload };

    case 'SET_WAIVER_SESSION_ID':
      return { ...state, waiver_session_id: action.payload };

    case 'SET_CUSTOMER':
      return { ...state, customer: action.payload };

    case 'SET_PRICE_BREAKDOWN':
      return { ...state, price_breakdown: action.payload };

    case 'SET_PARTICIPANTS':
      return {
        ...state,
        participant_count: action.payload.count,
        additional_participants: action.payload.additional,
      };

    case 'SET_BOOKING_ID':
      return { ...state, booking_id: action.payload };

    case 'SET_LEAD_ID':
      return { ...state, lead_id: action.payload };

    case 'SET_LEAD_SESSION_ID':
      return { ...state, lead_session_id: action.payload };

    case 'SET_LIVE_TEST_MODE':
      return {
        ...state,
        live_test_mode: action.payload.enabled,
        live_test_token: action.payload.enabled ? action.payload.token : undefined,
      };

    case 'SET_UTM':
      return { ...state, ...action.payload };

    case 'SET_ATTRIBUTION':
      return {
        ...state,
        first_touch_attribution: action.payload.first_touch ?? state.first_touch_attribution,
        last_touch_attribution: action.payload.last_touch,
      };

    case 'RESET':
      return {};

    default:
      return state;
  }
}

// ─── Progress step labels (fired in goNext for funnel tracking) ───────────────

const STEP_PROGRESS_LABELS: Partial<Record<StepId, string>> = {
  // trail: no lead yet at this point
  // lead_capture: handled by the lead creation API itself
  skill: 'skill_selected',
  location: 'location_selected',
  bike: 'bike_selected',
  datetime: 'date_selected',
  duration: 'duration_selected',
  addons: 'addons_selected',
  waiver: 'waiver_completed',
  // payment: fired explicitly in StepPayment before the checkout redirect
};

function fireLeadProgress(
  leadId: string,
  stepLabel: string,
  state: BookingState
): void {
  fetch(`/api/leads/${leadId}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: state.lead_session_id,
      last_step_completed: stepLabel,
      selected_skill_level: state.skill_level,
      selected_location_name: state.location_name,
      selected_bike: state.bike_rental,
      selected_date: state.date,
      selected_time_slot: state.time_slot,
      selected_duration_hours: state.duration_hours,
    }),
  }).catch(() => {}); // fail silently — never block the booking flow
}

// ─── Analytics Helpers ────────────────────────────────────────────────────────

function getFlowVariant(state: BookingState): string {
  if (state.trail_type === 'paved') return 'paved_7step';
  if (state.trail_type === 'mtb' && state.skill_level === 'first_time') return 'mtb_8step';
  if (state.trail_type === 'mtb') return 'mtb_9step';
  return 'unknown';
}

// ─── Context Interface ────────────────────────────────────────────────────────

interface BookingContextValue {
  state: BookingState;
  currentStepId: StepId;

  // Step navigation
  goNext: (stateOverride?: BookingState) => void;
  goPrev: () => void;

  // Booking data setters
  setTrailType: (type: TrailType) => void;
  setSkillLevel: (level: SkillLevel) => void;
  setLocation: (id: string, name: string) => void;
  setBikeRental: (rental: BikeRental) => void;
  setRiderHeight: (inches: number) => void;
  setDate: (date: string) => void;
  setTimeSlot: (time: string) => void;
  setDuration: (hours: DurationHours) => void;
  setAddons: (addons: Addons) => void;
  setWaiverAccepted: (accepted: boolean) => void;
  setWaiverParticipants: (participants: WaiverParticipant[]) => void;
  setWaiverSigners: (signers: WaiverSigner[]) => void;
  setWaiverSessionId: (id: string) => void;
  setCustomer: (customer: Customer) => void;
  setPriceBreakdown: (breakdown: PriceBreakdown) => void;
  setParticipants: (count: number, additional: AdditionalParticipant[]) => void;
  setBookingId: (id: string) => void;
  setLeadId: (id: string) => void;
  setLeadSessionId: (id: string) => void;
  setLiveTestMode: (enabled: boolean, token?: string) => void;
  setUtm: (params: { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string }) => void;
  captureAttribution: (attribution: AttributionPayload) => void;
  reset: () => void;
}

const BookingContext = createContext<BookingContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BookingProvider({ children }: { children: React.ReactNode }) {
  // Load initial state from localStorage once on mount
  const initial = useMemo(() => loadPersisted(), []);

  const [state, dispatch] = useReducer(bookingReducer, initial.booking as BookingState);
  const [currentStepId, setCurrentStepId] = useState<StepId>(initial.stepId);

  // Keep localStorage in sync — exclude price_breakdown and waiver_signers (large base64 blobs)
  useEffect(() => {
    const { price_breakdown, waiver_signers, ...booking } = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ booking, stepId: currentStepId }));
    } catch {
      // quota exceeded or private browsing — fail silently
    }
  }, [state, currentStepId]);

  // If persisted currentStepId is no longer in active steps (e.g. user was on
  // 'skill' with mtb, cleared cache, restored with paved), snap back to 'trail'.
  useEffect(() => {
    if (!isStepActive(currentStepId, state)) {
      setCurrentStepId(DEFAULT_STEP_ID);
    }
  }, [currentStepId, state]);

  // ─── Step Transition Tracking ───────────────────────────────────────────────
  // Fires booking_step_completed (forward) and booking_step_view (every step).
  // isInitialMountRef prevents spurious events on /booking/confirmation mount
  // after the Stripe redirect (shared layout keeps BookingProvider alive).

  const navigationDirectionRef = useRef<'forward' | 'back' | 'initial'>('initial');
  const prevStepIdRef = useRef<StepId>(currentStepId);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevStepIdRef.current = currentStepId;
      return;
    }

    const prevStep = prevStepIdRef.current;
    const direction = navigationDirectionRef.current;
    prevStepIdRef.current = currentStepId;

    if (prevStep === currentStepId) return;

    const activeSteps = getActiveSteps(state);
    const nextIndex = activeSteps.findIndex((s) => s.id === currentStepId);
    track('booking_step_view', {
      booking_step_name: currentStepId,
      booking_step_number: nextIndex + 1,
      booking_flow_variant: getFlowVariant(state),
      trail_type: state.trail_type,
    });

    if (direction === 'forward') {
      const prevIndex = activeSteps.findIndex((s) => s.id === prevStep);
      track('booking_step_completed', {
        booking_step_name: prevStep,
        booking_step_number: prevIndex + 1,
        booking_flow_variant: getFlowVariant(state),
        trail_type: state.trail_type,
        location_name: state.location_name,
        participant_count: state.participant_count,
        bike_rental: state.bike_rental,
        date_selected: state.date,
        duration_hours: state.duration_hours,
        addons_gopro: state.addons?.gopro ?? false,
        addons_pickup: state.addons?.pickup_dropoff ?? false,
        addons_electric_upgrade: state.addons?.electric_upgrade ?? false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepId]);
  // NOTE: `state` intentionally excluded — React batches all dispatches with
  // setCurrentStepId into one render, so the closure captures the latest state.

  // ─── Navigation ────────────────────────────────────────────────────────────

  const goNext = useCallback((stateOverride?: BookingState) => {
    const effectiveState = stateOverride ?? state;
    const leadId = effectiveState.lead_id ?? state.lead_id;
    const progressLabel = STEP_PROGRESS_LABELS[currentStepId];

    if (leadId && progressLabel) {
      fireLeadProgress(leadId, progressLabel, effectiveState);
    }

    navigationDirectionRef.current = 'forward';
    setCurrentStepId((prev) => {
      const next = getNextStepId(prev, effectiveState);
      return next ?? prev;
    });
  }, [state, currentStepId]);

  const goPrev = useCallback(() => {
    navigationDirectionRef.current = 'back';
    setCurrentStepId((prev) => {
      const previous = getPrevStepId(prev, state);
      return previous ?? prev;
    });
  }, [state]);

  // ─── Booking Data Setters ───────────────────────────────────────────────────

  const setTrailType = useCallback(
    (type: TrailType) => dispatch({ type: 'SET_TRAIL_TYPE', payload: type }),
    []
  );
  const setSkillLevel = useCallback(
    (level: SkillLevel) => dispatch({ type: 'SET_SKILL_LEVEL', payload: level }),
    []
  );
  const setLocation = useCallback(
    (id: string, name: string) => dispatch({ type: 'SET_LOCATION', payload: { id, name } }),
    []
  );
  const setBikeRental = useCallback(
    (rental: BikeRental) => dispatch({ type: 'SET_BIKE_RENTAL', payload: rental }),
    []
  );
  const setRiderHeight = useCallback(
    (inches: number) => dispatch({ type: 'SET_RIDER_HEIGHT', payload: inches }),
    []
  );
  const setDate = useCallback(
    (date: string) => dispatch({ type: 'SET_DATE', payload: date }),
    []
  );
  const setTimeSlot = useCallback(
    (time: string) => dispatch({ type: 'SET_TIME_SLOT', payload: time }),
    []
  );
  const setDuration = useCallback(
    (hours: DurationHours) => dispatch({ type: 'SET_DURATION', payload: hours }),
    []
  );
  const setAddons = useCallback(
    (addons: Addons) => dispatch({ type: 'SET_ADDONS', payload: addons }),
    []
  );
  const setWaiverAccepted = useCallback(
    (accepted: boolean) => dispatch({ type: 'SET_WAIVER_ACCEPTED', payload: accepted }),
    []
  );
  const setWaiverParticipants = useCallback(
    (participants: WaiverParticipant[]) => dispatch({ type: 'SET_WAIVER_PARTICIPANTS', payload: participants }),
    []
  );
  const setWaiverSigners = useCallback(
    (signers: WaiverSigner[]) => dispatch({ type: 'SET_WAIVER_SIGNERS', payload: signers }),
    []
  );
  const setWaiverSessionId = useCallback(
    (id: string) => dispatch({ type: 'SET_WAIVER_SESSION_ID', payload: id }),
    []
  );
  const setCustomer = useCallback(
    (customer: Customer) => dispatch({ type: 'SET_CUSTOMER', payload: customer }),
    []
  );
  const setPriceBreakdown = useCallback(
    (breakdown: PriceBreakdown) => dispatch({ type: 'SET_PRICE_BREAKDOWN', payload: breakdown }),
    []
  );
  const setParticipants = useCallback(
    (count: number, additional: AdditionalParticipant[]) =>
      dispatch({ type: 'SET_PARTICIPANTS', payload: { count, additional } }),
    []
  );
  const setBookingId = useCallback(
    (id: string) => dispatch({ type: 'SET_BOOKING_ID', payload: id }),
    []
  );
  const setLeadId = useCallback(
    (id: string) => dispatch({ type: 'SET_LEAD_ID', payload: id }),
    []
  );
  const setLeadSessionId = useCallback(
    (id: string) => dispatch({ type: 'SET_LEAD_SESSION_ID', payload: id }),
    []
  );
  const setLiveTestMode = useCallback(
    (enabled: boolean, token?: string) =>
      dispatch({ type: 'SET_LIVE_TEST_MODE', payload: { enabled, token } }),
    []
  );
  const setUtm = useCallback(
    (params: { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string }) =>
      dispatch({ type: 'SET_UTM', payload: params }),
    []
  );
  const captureAttribution = useCallback(
    (attribution: AttributionPayload) =>
      dispatch({
        type: 'SET_ATTRIBUTION',
        payload: {
          first_touch: state.first_touch_attribution ? undefined : attribution,
          last_touch: attribution,
        },
      }),
    [state.first_touch_attribution]
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setCurrentStepId(DEFAULT_STEP_ID);
    dispatch({ type: 'RESET' });
  }, []);

  return (
    <BookingContext.Provider
      value={{
        state,
        currentStepId,
        goNext,
        goPrev,
        setTrailType,
        setSkillLevel,
        setLocation,
        setBikeRental,
        setRiderHeight,
        setDate,
        setTimeSlot,
        setDuration,
        setAddons,
        setWaiverAccepted,
        setWaiverParticipants,
        setWaiverSigners,
        setWaiverSessionId,
        setCustomer,
        setPriceBreakdown,
        setParticipants,
        setBookingId,
        setLeadId,
        setLeadSessionId,
        setLiveTestMode,
        setUtm,
        captureAttribution,
        reset,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBooking(): BookingContextValue {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
