import type { SkillLevel, TrailType } from '@/types/booking';

export type PersistedBookingStepKey =
  | 'lead_captured'
  | 'skill_selected'
  | 'location_selected'
  | 'bike_selected'
  | 'date_selected'
  | 'duration_selected'
  | 'addons_selected'
  | 'waiver_completed'
  | 'payment_started'
  | 'booking_confirmed';

export interface BookingFlowStepDefinition {
  key: PersistedBookingStepKey;
  label: string;
}

export interface BookingProgressMeta {
  percent: number;
  completedSteps: number;
  totalSteps: number;
  currentStepKey: PersistedBookingStepKey | null;
  currentStepLabel: string | null;
}

const PERSISTED_STEP_LABELS: Record<PersistedBookingStepKey, string> = {
  lead_captured: 'Lead captured',
  skill_selected: 'Skill selected',
  location_selected: 'Location selected',
  bike_selected: 'Bike selected',
  date_selected: 'Date selected',
  duration_selected: 'Duration selected',
  addons_selected: 'Add-ons selected',
  waiver_completed: 'Waiver completed',
  payment_started: 'Payment started',
  booking_confirmed: 'Booking confirmed',
};

const PAVED_FLOW: PersistedBookingStepKey[] = [
  'lead_captured',
  'location_selected',
  'bike_selected',
  'date_selected',
  'waiver_completed',
  'payment_started',
  'booking_confirmed',
];

const MTB_FLOW: PersistedBookingStepKey[] = [
  'lead_captured',
  'skill_selected',
  'location_selected',
  'bike_selected',
  'date_selected',
  'duration_selected',
  'addons_selected',
  'waiver_completed',
  'payment_started',
  'booking_confirmed',
];

const MTB_FIRST_TIME_FLOW: PersistedBookingStepKey[] = [
  'lead_captured',
  'skill_selected',
  'location_selected',
  'bike_selected',
  'date_selected',
  'addons_selected',
  'waiver_completed',
  'payment_started',
  'booking_confirmed',
];

function toStepDefinitions(
  steps: PersistedBookingStepKey[]
): BookingFlowStepDefinition[] {
  return steps.map((key) => ({
    key,
    label: PERSISTED_STEP_LABELS[key],
  }));
}

export function getTrailFlowSteps(
  trailType?: TrailType | null,
  skillLevel?: SkillLevel | null
): BookingFlowStepDefinition[] {
  if (trailType === 'paved') {
    return toStepDefinitions(PAVED_FLOW);
  }

  if (trailType === 'mtb') {
    if (skillLevel === 'first_time') {
      return toStepDefinitions(MTB_FIRST_TIME_FLOW);
    }

    return toStepDefinitions(MTB_FLOW);
  }

  return [];
}

export function getStepIndex(
  trailType?: TrailType | null,
  lastStepCompleted?: string | null,
  skillLevel?: SkillLevel | null
): number {
  if (!trailType || !lastStepCompleted) return 0;

  const steps = getTrailFlowSteps(trailType, skillLevel);
  if (steps.length === 0) return 0;

  const index = steps.findIndex((step) => step.key === lastStepCompleted);
  return index >= 0 ? index + 1 : 0;
}

export function getBookingProgressPercent(
  trailType?: TrailType | null,
  lastStepCompleted?: string | null,
  isCompleted?: boolean,
  skillLevel?: SkillLevel | null
): number {
  if (isCompleted) return 100;

  const steps = getTrailFlowSteps(trailType, skillLevel);
  if (steps.length === 0) return 0;

  const completedSteps = getStepIndex(trailType, lastStepCompleted, skillLevel);
  if (completedSteps === 0) return 0;

  return Math.round((completedSteps / steps.length) * 100);
}

export function getBookingProgressMeta(input: {
  trailType?: TrailType | null;
  lastStepCompleted?: string | null;
  isCompleted?: boolean;
  skillLevel?: SkillLevel | null;
}): BookingProgressMeta {
  const steps = getTrailFlowSteps(input.trailType, input.skillLevel);
  const completedSteps = input.isCompleted
    ? steps.length
    : getStepIndex(input.trailType, input.lastStepCompleted, input.skillLevel);
  const currentStep = steps[Math.max(completedSteps - 1, 0)] ?? null;

  return {
    percent: getBookingProgressPercent(
      input.trailType,
      input.lastStepCompleted,
      input.isCompleted,
      input.skillLevel
    ),
    completedSteps,
    totalSteps: steps.length,
    currentStepKey: currentStep?.key ?? null,
    currentStepLabel: currentStep?.label ?? null,
  };
}

export { PERSISTED_STEP_LABELS };
