import type { BookingState } from '@/types/booking';

export type StepId =
  | 'trail'
  | 'skill'
  | 'location'
  | 'bike'
  | 'datetime'
  | 'duration'
  | 'addons'
  | 'waiver'
  | 'payment';

export interface StepDef {
  id: StepId;
  label: string;
  /** Return true to hide this step from the active flow */
  shouldSkip: (state: BookingState) => boolean;
  /** Return true when the user has completed this step */
  isComplete: (state: BookingState) => boolean;
}

export const STEPS: StepDef[] = [
  {
    id: 'trail',
    label: 'Trail Type',
    shouldSkip: () => false,
    isComplete: (s) => !!s.trail_type,
  },
  {
    id: 'skill',
    label: 'Skill Level',
    // Only shown for mountain bike trails
    shouldSkip: (s) => s.trail_type !== 'mtb',
    isComplete: (s) => !!s.skill_level,
  },
  {
    id: 'location',
    label: 'Location',
    shouldSkip: () => false,
    isComplete: (s) => !!s.location_id,
  },
  {
    id: 'bike',
    label: 'Bike',
    shouldSkip: () => false,
    isComplete: (s) => s.bike_rental !== undefined,
  },
  {
    id: 'datetime',
    label: 'Date & Time',
    shouldSkip: () => false,
    isComplete: (s) => !!s.date && !!s.time_slot,
  },
  {
    id: 'duration',
    label: 'Duration',
    // Paved always 2hrs; first-time MTB riders are also locked to 2hrs
    shouldSkip: (s) => s.trail_type === 'paved' || s.skill_level === 'first_time',
    isComplete: (s) => !!s.duration_hours,
  },
  {
    id: 'addons',
    label: 'Add-ons',
    shouldSkip: (s) => s.trail_type === 'paved',
    isComplete: () => true, // optional step - always passable
  },
  {
    id: 'waiver',
    label: 'Waiver',
    shouldSkip: () => false,
    isComplete: (s) => !!s.waiver_accepted,
  },
  {
    id: 'payment',
    label: 'Payment',
    shouldSkip: () => false,
    isComplete: () => false,
  },
];

export const DEFAULT_STEP_ID: StepId = 'trail';

/** Returns only the steps that are active for the current booking state */
export function getActiveSteps(state: BookingState): StepDef[] {
  return STEPS.filter((step) => !step.shouldSkip(state));
}

/** Finds the next step ID after the given one, given current state */
export function getNextStepId(currentId: StepId, state: BookingState): StepId | null {
  const active = getActiveSteps(state);
  const idx = active.findIndex((s) => s.id === currentId);
  return active[idx + 1]?.id ?? null;
}

/** Finds the previous step ID before the given one, given current state */
export function getPrevStepId(currentId: StepId, state: BookingState): StepId | null {
  const active = getActiveSteps(state);
  const idx = active.findIndex((s) => s.id === currentId);
  return active[idx - 1]?.id ?? null;
}

/** Returns true if stepId exists in the active steps for the given state */
export function isStepActive(stepId: StepId, state: BookingState): boolean {
  return getActiveSteps(state).some((s) => s.id === stepId);
}
