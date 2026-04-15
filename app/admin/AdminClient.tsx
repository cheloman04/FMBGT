'use client';

import { Fragment, useState } from 'react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  getBookingProgressMeta,
  PERSISTED_STEP_LABELS,
} from '@/lib/booking-flow-progress';
import type { SkillLevel, TrailType } from '@/types/booking';

interface WaiverRecord {
  id: string;
  booking_id: string | null;
  session_id?: string | null;
  signer_name: string;
  signer_role: string;
  participants_covered: string[];
  agreed_at: string;
  pdf_url: string | null;
  signature_url: string | null;
  guardian_relationship: string | null;
}

interface Booking {
  id: string;
  lead_id?: string | null;
  trail_type: string;
  date: string;
  time_slot: string;
  duration_hours: number;
  bike_rental: string;
  rider_height_inches: number | null;
  participant_count: number | null;
  participant_info: AdditionalParticipant[] | null;
  total_price: number;
  status: string;
  created_at: string;
  location_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  zip_code: string | null;
  marketing_source: string | null;
  attribution_snapshot?: Record<string, unknown> | null;
  waiver_records: WaiverRecord[];
  deposit_amount: number | null;
  remaining_balance_amount: number | null;
  remaining_balance_due_at: string | null;
  deposit_payment_status: string | null;
  remaining_balance_status: string | null;
  stripe_payment_method_id: string | null;
  review_request_enrollment?: BookingReviewRequestEnrollment | null;
}

function getBookingAttributionMeta(booking: Booking) {
  const snapshot = booking.attribution_snapshot;

  if (!snapshot || typeof snapshot !== 'object') {
    return {
      isEmailConversion: false,
      templateKey: null as string | null,
      stepKey: null as string | null,
      flow: null as string | null,
    };
  }

  const readString = (key: string) => {
    const value = snapshot[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
  };

  return {
    isEmailConversion: readString('utm_source') === 'email',
    templateKey: readString('template_key'),
    stepKey: readString('step_key'),
    flow: readString('flow'),
  };
}

interface BookingReviewRequestEnrollment {
  id: string;
  booking_id: string;
  status: string;
  enrolled_at: string;
  next_step_due_at: string | null;
  review_left_at: string | null;
  review_platform: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  stop_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface AdditionalParticipant {
  name: string;
  bike_rental?: string;
  height_inches?: number;
}

interface RiderDetail {
  id: string;
  label: string;
  name: string;
  bikeLabel: string;
  heightLabel: string;
  needsSizing: boolean;
}

interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  zip_code: string | null;
  heard_about_us: string | null;
  selected_trail_type: TrailType | null;
  selected_skill_level?: SkillLevel | null;
  selected_location_name: string | null;
  selected_bike: string | null;
  selected_date: string | null;
  selected_time_slot: string | null;
  selected_duration_hours: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  last_step_completed: string | null;
  last_activity_at: string;
  status: string;
  created_at: string;
  booking_id: string | null;
  converted_at?: string | null;
  lost_at?: string | null;
  followup_enrollment?: LeadFollowUpEnrollment | null;
  followup_steps?: LeadFollowUpStep[];
}

interface LeadFollowUpEnrollment {
  id: string;
  lead_id: string;
  trail_type: string;
  sequence_key: string;
  status: string;
  enrolled_at: string;
  next_step_due_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  lost_at: string | null;
  stop_reason: string | null;
  webhook_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

interface LeadFollowUpStep {
  id: string;
  enrollment_id: string;
  step_number: number;
  step_key: string;
  scheduled_for: string;
  sent_at: string | null;
  status: string;
  channel: string;
  template_key: string;
  skipped_at: string | null;
  cancelled_at: string | null;
  skip_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  leads: number;
  confirmed: number;
  completed: number;
  revenue: number;
  projectedRevenue: number;
  conversionRate: number | null;
  balancePending: number;
  balanceFailed: number;
}

interface Props {
  bookings: Booking[];
  leads: Lead[];
  stats: Stats;
  currentStatus: string;
}

interface DeleteDialogState {
  id: string;
  customerName: string;
  locationName: string;
  date: string;
}

const STATUS_OPTIONS = ['all', 'leads', 'confirmed', 'completed', 'cancelled', 'refunded'];

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  refunded: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const STEP_LABELS: Record<string, string> = {
  ...PERSISTED_STEP_LABELS,
  addons_selected: 'Add-ons viewed',
  waiver_completed: 'Waiver signed',
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHrs = diffMs / 3_600_000;
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  return formatDateTime(iso);
}

function LeadFreshness({ lastActivityAt }: { lastActivityAt: string }) {
  const diffHrs = (Date.now() - new Date(lastActivityAt).getTime()) / 3_600_000;
  if (diffHrs < 24) {
    return (
      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
        Hot
      </span>
    );
  }
  if (diffHrs < 72) {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
        Warm
      </span>
    );
  }
  return null;
}

function getLeadBookingProgress(lead: Lead) {
  return getBookingProgressMeta({
    trailType: lead.selected_trail_type,
    skillLevel: lead.selected_skill_level ?? null,
    lastStepCompleted: lead.last_step_completed,
    isCompleted: lead.status === 'converted' || !!lead.converted_at || !!lead.booking_id,
  });
}

function LeadProgressBar({ lead }: { lead: Lead }) {
  const progress = getLeadBookingProgress(lead);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-foreground">
          {progress.percent}% complete
        </span>
        <span className="text-[11px] text-muted-foreground">
          {progress.totalSteps > 0
            ? `${progress.completedSteps}/${progress.totalSteps} steps`
            : 'No flow data'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted/80">
        <div
          className="h-full rounded-full bg-green-600 transition-all duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}

function formatStepKey(stepKey: string): string {
  if (stepKey === '1_hour') return '1 hour';
  if (stepKey === '1_day') return '1 day';
  if (stepKey === '1_week') return '1 week';
  return stepKey;
}

function getReviewRequestStatusLabel(enrollment?: BookingReviewRequestEnrollment | null) {
  if (!enrollment) return 'Review not started';
  if (enrollment.status === 'reviewed') return 'Review received';
  if (enrollment.status === 'active') return 'Review request active';
  if (enrollment.status === 'completed') return 'Review sequence complete';
  if (enrollment.status === 'cancelled') return 'Review request cancelled';
  return enrollment.status;
}

function getLeadFollowUpDisplay(lead: Lead): {
  label: string;
  badgeClass: string;
  detail: string;
} {
  if (lead.status === 'converted' || lead.converted_at || lead.booking_id) {
    return {
      label: 'Converted',
      badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      detail: 'Lead converted to booking',
    };
  }

  if (lead.status === 'lost' || lead.lost_at) {
    return {
      label: 'Lost',
      badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      detail: lead.followup_enrollment?.lost_at
        ? `Lost ${formatDateTime(lead.followup_enrollment.lost_at)}`
        : 'Sequence exhausted without conversion',
    };
  }

  const enrollment = lead.followup_enrollment;
  if (!enrollment) {
    return {
      label: 'Not started',
      badgeClass: 'bg-muted text-muted-foreground',
      detail: 'Manual follow-up has not been started',
    };
  }

  const sentSteps = (lead.followup_steps ?? []).filter((step) => step.status === 'sent');
  const nextPending = (lead.followup_steps ?? []).find((step) => step.status === 'pending');

  if (enrollment.status === 'active') {
    return {
      label: enrollment.webhook_triggered_at ? 'Active' : 'Enrolled',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      detail: nextPending
        ? `Next ${formatStepKey(nextPending.step_key)} due ${formatDateTime(nextPending.scheduled_for)}`
        : sentSteps.length > 0
          ? `Last sent ${formatStepKey(sentSteps[sentSteps.length - 1]!.step_key)}`
          : `Enrolled ${formatDateTime(enrollment.enrolled_at)}`,
    };
  }

  if (enrollment.status === 'cancelled') {
    return {
      label: 'Stopped',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      detail: enrollment.stop_reason ?? 'Follow-up cancelled',
    };
  }

  return {
    label: enrollment.status,
    badgeClass: 'bg-muted text-muted-foreground',
    detail: enrollment.sequence_key,
  };
}

function getLeadNextPendingStep(lead: Lead): LeadFollowUpStep | null {
  return (lead.followup_steps ?? []).find((step) => step.status === 'pending') ?? null;
}

function getLeadLastSentStep(lead: Lead): LeadFollowUpStep | null {
  const sentSteps = (lead.followup_steps ?? []).filter((step) => step.status === 'sent');
  return sentSteps.length > 0 ? sentSteps[sentSteps.length - 1] ?? null : null;
}

function canStartLeadFollowUp(lead: Lead): boolean {
  if (lead.status === 'converted' || lead.converted_at || lead.booking_id) return false;
  if (lead.status === 'lost' || lead.lost_at) return false;
  return lead.followup_enrollment?.status !== 'active';
}

function getBookingStart(booking: Booking) {
  return new Date(`${booking.date}T${booking.time_slot || '00:00'}:00`);
}

function getNearestUpcomingBooking(bookings: Booking[]) {
  const now = new Date();
  return (
    bookings
      .filter((booking) => !['cancelled', 'refunded', 'completed'].includes(booking.status))
      .filter((booking) => getBookingStart(booking).getTime() >= now.getTime())
      .sort((a, b) => getBookingStart(a).getTime() - getBookingStart(b).getTime())[0] ?? null
  );
}

function BalanceBadge({
  status,
  amount,
  dueAt,
}: {
  status: string | null;
  amount: number | null;
  dueAt: string | null;
}) {
  if (!status || status === 'pending') {
    return (
      <span className="text-xs text-muted-foreground">
        Balance {amount ? formatPrice(amount) : ''} due {dueAt ? formatDateTime(dueAt) : '-'}
      </span>
    );
  }
  if (status === 'paid') {
    return (
      <span className="text-xs text-green-700 dark:text-green-400">
        Balance {amount ? formatPrice(amount) : ''} paid
      </span>
    );
  }
  if (status === 'failed') {
    return <span className="text-xs font-semibold text-red-600 dark:text-red-400">Balance charge failed</span>;
  }
  if (status === 'waived') {
    return <span className="text-xs text-muted-foreground">Balance waived</span>;
  }
  return null;
}

function formatBikeLabel(bikeRental: string | null | undefined): string {
  if (!bikeRental || bikeRental === 'none') return 'BYOB';
  if (bikeRental === 'electric') return 'E-Bike';
  return 'Regular Bike';
}

function formatHeightLabel(heightInches: number | null | undefined): string {
  if (!heightInches) return 'Size missing';
  return `${heightInches}"`;
}

function buildRiderDetails(booking: Booking): RiderDetail[] {
  const riders: RiderDetail[] = [
    {
      id: `${booking.id}-lead`,
      label: 'Lead Rider',
      name: booking.customer_name,
      bikeLabel: formatBikeLabel(booking.bike_rental),
      heightLabel: formatHeightLabel(booking.rider_height_inches),
      needsSizing: booking.bike_rental !== 'none' && !booking.rider_height_inches,
    },
  ];

  for (const [index, participant] of (booking.participant_info ?? []).entries()) {
    riders.push({
      id: `${booking.id}-participant-${index}`,
      label: `Rider ${index + 2}`,
      name: participant.name || `Rider ${index + 2}`,
      bikeLabel: formatBikeLabel(participant.bike_rental),
      heightLabel: formatHeightLabel(participant.height_inches),
      needsSizing: participant.bike_rental !== 'none' && !participant.height_inches,
    });
  }

  return riders;
}

function summarizeBikeMix(riders: RiderDetail[]): string {
  const counts = riders.reduce<Record<string, number>>((acc, rider) => {
    acc[rider.bikeLabel] = (acc[rider.bikeLabel] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([label, count]) => `${count} ${label}`)
    .join(' · ');
}

function RidersPanel({ riders }: { riders: RiderDetail[] }) {
  const missingCount = riders.filter((rider) => rider.needsSizing).length;

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Riders & Bike Sizing</p>
          <p className="mt-1 text-sm text-muted-foreground">{summarizeBikeMix(riders)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${missingCount > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
          {missingCount > 0 ? `${missingCount} size missing` : 'Sizing ready'}
        </span>
      </div>

      <div className="space-y-2">
        {riders.map((rider) => (
          <div key={rider.id} className="rounded-xl border border-border bg-background/80 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rider.label}</p>
                <p className="truncate text-sm font-semibold text-foreground">{rider.name}</p>
              </div>
              {rider.needsSizing && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Needs size
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{rider.bikeLabel}</span>
              <span className={`rounded-full px-2 py-1 text-[11px] ${rider.needsSizing ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>
                Height {rider.heightLabel}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaiverBadge({ records }: { records: WaiverRecord[] }) {
  if (records.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
        No waivers
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
      {records.length} waiver{records.length > 1 ? 's' : ''}
    </span>
  );
}

function WaiverPanel({ records }: { records: WaiverRecord[] }) {
  if (records.length === 0) {
    return <p className="text-xs italic text-muted-foreground">No waiver records for this booking.</p>;
  }

  return (
    <div className="space-y-2">
      {records.map((w) => (
        <div key={w.id} className="space-y-1 rounded-xl border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">{w.signer_name}</p>
              <p className="text-xs text-muted-foreground">
                {w.signer_role === 'participant'
                  ? 'Participant signed for themselves'
                  : `Guardian (${w.guardian_relationship ?? 'guardian'}) signed for: ${w.participants_covered.join(', ')}`}
              </p>
              <p className="text-xs text-muted-foreground">
                Signed: {new Date(w.agreed_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {w.pdf_url && (
                <a href={w.pdf_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-blue-200 px-2 py-1 text-xs text-blue-600 hover:underline dark:border-blue-800 dark:text-blue-400">PDF</a>
              )}
              {w.signature_url && (
                <a href={w.signature_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:underline">Sig</a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getLeadIntentSummary(lead: Lead): string[] {
  const summary: string[] = [];
  if (lead.selected_trail_type) summary.push(lead.selected_trail_type === 'mtb' ? 'Mountain Bike' : 'Paved Trail');
  if (lead.selected_location_name) summary.push(lead.selected_location_name);
  if (lead.selected_bike) summary.push(`Bike: ${formatBikeLabel(lead.selected_bike)}`);
  if (lead.selected_date) summary.push(`Date: ${formatDate(lead.selected_date)}`);
  if (lead.selected_time_slot) summary.push(`Time: ${lead.selected_time_slot}`);
  if (lead.selected_duration_hours) summary.push(`Duration: ${lead.selected_duration_hours}h`);
  return summary;
}

function LeadDetailPanel({ lead }: { lead: Lead }) {
  const intentSummary = getLeadIntentSummary(lead);
  const followUpDisplay = getLeadFollowUpDisplay(lead);
  const nextPending = getLeadNextPendingStep(lead);
  const lastSent = getLeadLastSentStep(lead);
  const bookingProgress = getLeadBookingProgress(lead);

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Contact</p>
          <div className="mt-2 space-y-1 text-sm">
            <p className="font-semibold text-foreground">{lead.full_name}</p>
            <p className="text-muted-foreground">{lead.email}</p>
            {lead.phone && <p className="text-muted-foreground">{lead.phone}</p>}
            {lead.zip_code && <p className="text-muted-foreground">ZIP {lead.zip_code}</p>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Booking Intent</p>
          <div className="mt-2 space-y-1 text-sm">
            {intentSummary.length > 0 ? (
              intentSummary.map((item) => (
                <p key={item} className="text-foreground">{item}</p>
              ))
            ) : (
              <p className="text-muted-foreground">Only contact info captured so far.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Attribution</p>
          <div className="mt-2 space-y-1 text-sm">
            {lead.heard_about_us && <p className="text-foreground">Heard about us: {lead.heard_about_us}</p>}
            {lead.utm_source && <p className="text-foreground">UTM Source: {lead.utm_source}</p>}
            {lead.utm_medium && <p className="text-foreground">UTM Medium: {lead.utm_medium}</p>}
            {lead.utm_campaign && <p className="text-foreground">UTM Campaign: {lead.utm_campaign}</p>}
            {lead.utm_content && <p className="text-foreground">UTM Content: {lead.utm_content}</p>}
            {lead.utm_term && <p className="text-foreground">UTM Term: {lead.utm_term}</p>}
            {!lead.heard_about_us && !lead.utm_source && <p className="text-muted-foreground">No attribution data captured.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Booking Progress</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {bookingProgress.totalSteps > 0
                ? `${bookingProgress.completedSteps} of ${bookingProgress.totalSteps} real flow steps completed`
                : 'Waiting for enough booking data to calculate progress'}
            </p>
          </div>
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
            {bookingProgress.percent}%
          </span>
        </div>
        <div className="mt-4">
          <LeadProgressBar lead={lead} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/70 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Follow-Up Context</p>
        <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-sm font-medium text-foreground">Follow-up status</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${followUpDisplay.badgeClass}`}>
                {followUpDisplay.label}
              </span>
              <span className="text-sm text-muted-foreground">{followUpDisplay.detail}</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Enrolled at</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {lead.followup_enrollment?.enrolled_at
                ? formatDateTime(lead.followup_enrollment.enrolled_at)
                : 'Not enrolled'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Last completed step</p>
            <p className="mt-1 text-sm text-muted-foreground">{lead.last_step_completed ? (STEP_LABELS[lead.last_step_completed] ?? lead.last_step_completed) : 'Unknown'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Last active</p>
            <p className="mt-1 text-sm text-muted-foreground">{timeAgo(lead.last_activity_at)} · {formatDateTime(lead.last_activity_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminClient({ bookings, leads, stats, currentStatus }: Props) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [isNextBookingExpanded, setIsNextBookingExpanded] = useState(false);
  const [selectedMobileBookingId, setSelectedMobileBookingId] = useState<string | null>(null);
  const [localBookings, setLocalBookings] = useState(bookings);
  const [markingReviewBookingId, setMarkingReviewBookingId] = useState<string | null>(null);
  const [localLeads, setLocalLeads] = useState(leads);
  const [expandedWaivers, setExpandedWaivers] = useState<Set<string>>(new Set());
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());
  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);
  const [leadFollowUpStatus, setLeadFollowUpStatus] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const isLeadsView = currentStatus === 'leads';
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredLeads = normalizedSearch
    ? localLeads.filter((lead) =>
        [
          lead.full_name,
          lead.email,
          lead.phone,
          lead.zip_code,
          lead.heard_about_us,
          lead.utm_source,
          lead.utm_campaign,
          lead.selected_trail_type,
          lead.selected_location_name,
          lead.last_step_completed,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      )
    : localLeads;
  const filteredBookings = normalizedSearch
    ? localBookings.filter((booking) =>
        [
          booking.customer_name,
          booking.customer_email,
          booking.customer_phone,
          booking.zip_code,
          booking.marketing_source,
          booking.attribution_snapshot ? JSON.stringify(booking.attribution_snapshot) : null,
          booking.location_name,
          booking.trail_type,
          booking.status,
          booking.time_slot,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      )
    : localBookings;
  const nearestBooking = isLeadsView ? null : getNearestUpcomingBooking(localBookings);
  const selectedMobileBooking =
    filteredBookings.find((booking) => booking.id === selectedMobileBookingId) ??
    localBookings.find((booking) => booking.id === selectedMobileBookingId) ??
    null;
  const selectedMobileBookingRiders = selectedMobileBooking ? buildRiderDetails(selectedMobileBooking) : [];

  const toggleWaivers = (id: string) => {
    setExpandedWaivers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleLead = (id: string) => {
    setExpandedLeads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSendLeadFollowUp = async (leadId: string) => {
    setSendingLeadId(leadId);
    setLeadFollowUpStatus((prev) => ({ ...prev, [leadId]: '' }));
    try {
      const res = await fetch('/api/admin/send-lead-follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const data = await res.json();
      if (res.ok) {
        const nowIso = new Date().toISOString();
        const oneHourIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const oneDayIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const oneWeekIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        setLeadFollowUpStatus((prev) => ({
          ...prev,
          [leadId]: data.already_active ? 'Follow-up already active' : 'Follow-up enrolled',
        }));
        setLocalLeads((prev) =>
          prev.map((lead) =>
            lead.id === leadId
              ? {
                  ...lead,
                  followup_enrollment: {
                    ...(lead.followup_enrollment ?? {
                      id: data.enrollment_id,
                      lead_id: lead.id,
                      trail_type: lead.selected_trail_type ?? 'mtb',
                      sequence_key: 'default_lead_recovery',
                      status: 'active',
                      enrolled_at: new Date().toISOString(),
                      next_step_due_at: null,
                      completed_at: null,
                      cancelled_at: null,
                      lost_at: null,
                      stop_reason: null,
                      webhook_triggered_at: nowIso,
                      created_at: nowIso,
                      updated_at: nowIso,
                    }),
                    status: 'active',
                    next_step_due_at: lead.followup_enrollment?.next_step_due_at ?? oneHourIso,
                    webhook_triggered_at: lead.followup_enrollment?.webhook_triggered_at ?? nowIso,
                    updated_at: nowIso,
                  },
                  followup_steps:
                    lead.followup_steps && lead.followup_steps.length > 0
                      ? lead.followup_steps
                      : [
                          {
                            id: `${data.enrollment_id}-1-hour`,
                            enrollment_id: data.enrollment_id,
                            step_number: 1,
                            step_key: '1_hour',
                            scheduled_for: oneHourIso,
                            sent_at: null,
                            status: 'pending',
                            channel: 'email',
                            template_key: `${lead.selected_trail_type ?? 'mtb'}_1_hour`,
                            skipped_at: null,
                            cancelled_at: null,
                            skip_reason: null,
                            created_at: nowIso,
                            updated_at: nowIso,
                          },
                          {
                            id: `${data.enrollment_id}-1-day`,
                            enrollment_id: data.enrollment_id,
                            step_number: 2,
                            step_key: '1_day',
                            scheduled_for: oneDayIso,
                            sent_at: null,
                            status: 'pending',
                            channel: 'email',
                            template_key: `${lead.selected_trail_type ?? 'mtb'}_1_day`,
                            skipped_at: null,
                            cancelled_at: null,
                            skip_reason: null,
                            created_at: nowIso,
                            updated_at: nowIso,
                          },
                          {
                            id: `${data.enrollment_id}-1-week`,
                            enrollment_id: data.enrollment_id,
                            step_number: 3,
                            step_key: '1_week',
                            scheduled_for: oneWeekIso,
                            sent_at: null,
                            status: 'pending',
                            channel: 'email',
                            template_key: `${lead.selected_trail_type ?? 'mtb'}_1_week`,
                            skipped_at: null,
                            cancelled_at: null,
                            skip_reason: null,
                            created_at: nowIso,
                            updated_at: nowIso,
                          },
                        ],
                }
              : lead
          )
        );
      } else {
        setLeadFollowUpStatus((prev) => ({ ...prev, [leadId]: data.error ?? 'Failed to send' }));
      }
    } finally {
      setSendingLeadId(null);
    }
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    setUpdating(bookingId);
    try {
      const res = await fetch('/api/admin/update-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, status: newStatus }),
      });
      if (res.ok) {
        setLocalBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b)));
      }
    } finally {
      setUpdating(null);
    }
  };

  const handleRetryCharge = async (bookingId: string) => {
    setRetrying(bookingId);
    setRetryErrors((prev) => ({ ...prev, [bookingId]: '' }));
    try {
      const res = await fetch('/api/admin/retry-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const data = await res.json();
      if (res.ok) {
        setLocalBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, remaining_balance_status: 'paid' } : b)));
      } else {
        setRetryErrors((prev) => ({ ...prev, [bookingId]: data.error ?? 'Retry failed' }));
      }
    } finally {
      setRetrying(null);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    setDeleting(bookingId);
    try {
      const res = await fetch('/api/admin/delete-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      if (res.ok) {
        setLocalBookings((prev) => prev.filter((b) => b.id !== bookingId));
        setExpandedWaivers((prev) => {
          const next = new Set(prev);
          next.delete(bookingId);
          return next;
        });
        if (selectedMobileBookingId === bookingId) {
          setSelectedMobileBookingId(null);
        }
      }
    } finally {
      setDeleting(null);
      setDeleteDialog(null);
    }
  };

  const handleMarkReviewReceived = async (bookingId: string) => {
    const booking = localBookings.find((item) => item.id === bookingId);
    const enrollmentId = booking?.review_request_enrollment?.id;
    if (!enrollmentId) return;

    setMarkingReviewBookingId(bookingId);
    try {
      const res = await fetch('/api/admin/mark-review-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollment_id: enrollmentId }),
      });

      if (res.ok) {
        const nowIso = new Date().toISOString();
        setLocalBookings((prev) =>
          prev.map((item) =>
            item.id === bookingId
              ? {
                  ...item,
                  review_request_enrollment: item.review_request_enrollment
                    ? {
                        ...item.review_request_enrollment,
                        status: 'reviewed',
                        review_left_at: nowIso,
                        review_platform: item.review_request_enrollment.review_platform ?? 'manual_admin',
                        completed_at: nowIso,
                        stop_reason: 'review_received',
                        next_step_due_at: null,
                        updated_at: nowIso,
                      }
                    : item.review_request_enrollment,
                }
              : item
          )
        );
      }
    } finally {
      setMarkingReviewBookingId(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    window.location.href = '/admin/login';
  };

  const filterUrl = (status: string) => `/admin?status=${status}`;

  const statCards = [
    {
      label: 'Total Bookings',
      value: stats.total,
      className: 'border-border bg-card/90',
      mobileSpanClassName: 'col-span-1',
      href: filterUrl('all'),
    },
    {
      label: 'Leads',
      value: stats.leads,
      className: 'border-blue-500/30 bg-gradient-to-br from-blue-500/[0.08] via-card/95 to-card/90',
      valueClassName: 'text-blue-400 dark:text-blue-300',
      mobileSpanClassName: 'col-span-1',
      href: filterUrl('leads'),
    },
    {
      label: 'Revenue',
      value: formatPrice(stats.revenue),
      className: 'border-green-500/30 bg-gradient-to-br from-green-500/[0.10] via-card/95 to-card/90',
      valueClassName: 'tracking-tight',
      featured: true,
      mobileSpanClassName: 'col-span-2',
    },
    {
      label: 'Projected Revenue',
      value: formatPrice(stats.projectedRevenue),
      className: 'border-green-500/30 bg-gradient-to-br from-green-500/[0.10] via-card/95 to-card/90',
      valueClassName: 'tracking-tight',
      featured: true,
      mobileSpanClassName: 'col-span-2',
    },
    {
      label: 'Confirmed',
      value: stats.confirmed,
      className: 'border-border bg-card/90',
      mobileSpanClassName: 'col-span-1',
    },
    {
      label: stats.conversionRate !== null ? `Conversion ${stats.conversionRate}%` : 'Completed',
      value: stats.conversionRate !== null ? `${stats.conversionRate}%` : stats.completed,
      className: 'border-border bg-card/90',
      mobileSpanClassName: 'col-span-1',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.05),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.10),transparent_58%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {deleteDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => (deleting ? undefined : setDeleteDialog(null))} />
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-zinc-950 shadow-[0_0_0_1px_rgba(239,68,68,0.08),0_20px_80px_rgba(0,0,0,0.55)]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/70 to-transparent" />
              <div className="p-6">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.66 18h16.68a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-foreground">Delete Booking?</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This will permanently remove the booking for <span className="font-semibold text-foreground">{deleteDialog.customerName}</span>, along with linked waiver records from the dashboard.
                </p>
                <div className="mt-4 rounded-xl border border-border bg-background/60 p-4 text-sm">
                  <p className="font-medium text-foreground">{deleteDialog.locationName}</p>
                  <p className="mt-1 text-muted-foreground">{formatDate(deleteDialog.date)}</p>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button onClick={() => setDeleteDialog(null)} disabled={!!deleting} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">Keep Booking</button>
                  <button onClick={() => handleDeleteBooking(deleteDialog.id)} disabled={!!deleting} className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50">
                    {deleting === deleteDialog.id ? 'Deleting...' : 'Delete Permanently'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedMobileBooking && (
          <div className="fixed inset-0 z-40 flex sm:hidden">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedMobileBookingId(null)}
            />
            <div className="relative ml-auto flex h-full w-full flex-col overflow-hidden border-l border-border/70 bg-background shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_60px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between border-b border-border/70 bg-card/90 px-4 py-4 backdrop-blur-xl">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-green-400">Booking Details</p>
                  <h2 className="truncate text-lg font-bold text-foreground">{selectedMobileBooking.customer_name}</h2>
                </div>
                <button
                  onClick={() => setSelectedMobileBookingId(null)}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-card/90 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">{selectedMobileBooking.customer_name}</p>
                        <p className="truncate text-sm text-muted-foreground">{selectedMobileBooking.customer_email}</p>
                        {selectedMobileBooking.customer_phone && (
                          <p className="text-sm text-muted-foreground">{selectedMobileBooking.customer_phone}</p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_COLORS[selectedMobileBooking.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {selectedMobileBooking.status}
                      </span>
                    </div>
                    {(selectedMobileBooking.zip_code || selectedMobileBooking.marketing_source) && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {selectedMobileBooking.zip_code && (
                          <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">ZIP {selectedMobileBooking.zip_code}</span>
                        )}
                        {selectedMobileBooking.marketing_source && (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs capitalize text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {selectedMobileBooking.marketing_source}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/70 bg-card/70 p-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
                      <p className="text-sm font-medium leading-5 text-foreground">{selectedMobileBooking.location_name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ride</p>
                      <p className="text-sm leading-5 text-foreground">{selectedMobileBooking.trail_type === 'mtb' ? 'MTB' : 'Paved'} · {selectedMobileBooking.duration_hours}hr</p>
                      <p className="text-sm text-muted-foreground">{summarizeBikeMix(selectedMobileBookingRiders)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date</p>
                      <p className="text-sm font-medium text-foreground">{formatDate(selectedMobileBooking.date)}</p>
                      <p className="text-sm text-muted-foreground">{selectedMobileBooking.time_slot}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
                      <p className="text-base font-semibold text-foreground">{formatPrice(selectedMobileBooking.total_price)}</p>
                    </div>
                  </div>

                  <RidersPanel riders={selectedMobileBookingRiders} />

                  <div className="space-y-2 rounded-2xl border border-border/70 bg-card/70 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
                      <span className="text-sm font-semibold text-foreground">{formatPrice(selectedMobileBooking.total_price)}</span>
                    </div>
                    <BalanceBadge
                      status={selectedMobileBooking.remaining_balance_status}
                      amount={selectedMobileBooking.remaining_balance_amount}
                      dueAt={selectedMobileBooking.remaining_balance_due_at}
                    />
                    {selectedMobileBooking.remaining_balance_status === 'failed' && (
                      <button
                        onClick={() => handleRetryCharge(selectedMobileBooking.id)}
                        disabled={retrying === selectedMobileBooking.id}
                        className="rounded-xl bg-red-100 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                      >
                        {retrying === selectedMobileBooking.id ? 'Retrying...' : 'Retry charge'}
                      </button>
                    )}
                    {retryErrors[selectedMobileBooking.id] && (
                      <p className="text-xs text-red-600 dark:text-red-400">{retryErrors[selectedMobileBooking.id]}</p>
                    )}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
                    {selectedMobileBooking.review_request_enrollment && (
                      <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Review Request</p>
                        <p className="mt-1 text-sm text-foreground">
                          {getReviewRequestStatusLabel(selectedMobileBooking.review_request_enrollment)}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                      <select
                        value={selectedMobileBooking.status}
                        disabled={updating === selectedMobileBooking.id}
                        onChange={(e) => handleStatusChange(selectedMobileBooking.id, e.target.value)}
                        className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                      >
                        <option value="confirmed">confirmed</option>
                        <option value="completed">completed</option>
                        <option value="cancelled">cancelled</option>
                        <option value="refunded">refunded</option>
                      </select>
                      <button
                        onClick={() =>
                          setDeleteDialog({
                            id: selectedMobileBooking.id,
                            customerName: selectedMobileBooking.customer_name,
                            locationName: selectedMobileBooking.location_name,
                            date: selectedMobileBooking.date,
                          })
                        }
                        disabled={deleting === selectedMobileBooking.id}
                        className="min-h-11 rounded-xl border border-red-500/40 px-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {deleting === selectedMobileBooking.id ? 'Deleting...' : 'Delete booking'}
                      </button>
                      {selectedMobileBooking.status === 'completed' &&
                        selectedMobileBooking.review_request_enrollment &&
                        selectedMobileBooking.review_request_enrollment.status !== 'reviewed' && (
                          <button
                            onClick={() => handleMarkReviewReceived(selectedMobileBooking.id)}
                            disabled={markingReviewBookingId === selectedMobileBooking.id}
                            className="min-h-11 rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
                          >
                            {markingReviewBookingId === selectedMobileBooking.id ? 'Saving...' : 'Mark Review Received'}
                          </button>
                        )}
                    </div>
                  </div>

                  <RidersPanel riders={selectedMobileBookingRiders} />

                  <div className="space-y-2 rounded-2xl border border-border/70 bg-card/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Waivers</p>
                      <WaiverBadge records={selectedMobileBooking.waiver_records} />
                    </div>
                    {selectedMobileBooking.waiver_records.length > 0 && (
                      <button
                        onClick={() => toggleWaivers(selectedMobileBooking.id)}
                        className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        {expandedWaivers.has(selectedMobileBooking.id) ? 'Hide waiver details' : 'View waiver details'}
                      </button>
                    )}
                    {expandedWaivers.has(selectedMobileBooking.id) && (
                      <WaiverPanel records={selectedMobileBooking.waiver_records} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-5 rounded-2xl border border-border/70 bg-card/88 p-4 shadow-[0_18px_40px_rgba(23,26,20,0.08)] backdrop-blur-sm sm:mb-8 sm:p-5 dark:shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <Image src="https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png" alt="Florida MTB Guided Tours" width={52} height={52} className="h-11 w-11 rounded-xl object-contain shadow-[0_10px_24px_rgba(0,0,0,0.2)] sm:h-[52px] sm:w-[52px]" />
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">Admin Dashboard</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">Florida Mountain Bike Trail Guided Tours</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="text-xs uppercase tracking-[0.24em] text-green-400 sm:hidden">Operations</div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button onClick={handleLogout} className="rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Sign Out</button>
              </div>
            </div>
          </div>
        </div>

        {/* Next booking banner */}
        {nearestBooking && currentStatus !== 'completed' && (
          <div className="relative mb-5 overflow-hidden rounded-2xl border border-green-500/30 bg-gradient-to-r from-green-500/[0.06] via-card/95 to-green-500/[0.04] p-4 shadow-[0_0_0_1px_rgba(34,197,94,0.06),0_10px_28px_rgba(22,30,18,0.06)] sm:mb-8 sm:p-5 dark:border-green-500/35 dark:bg-gradient-to-r dark:from-green-950/35 dark:via-card dark:to-emerald-950/20 dark:shadow-[0_0_0_1px_rgba(34,197,94,0.10),0_0_18px_rgba(34,197,94,0.06)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.08),transparent_38%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_35%)]" />
            <div className="relative">
              <div className="space-y-2">
                <div className="inline-flex items-center rounded-full border border-green-500/35 bg-green-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-700 dark:text-green-300">Your Next Booking</div>
                <div>
                  <h2 className="text-lg font-bold text-foreground sm:text-xl">{nearestBooking.customer_name}</h2>
                  <p className="text-sm leading-6 text-muted-foreground">{nearestBooking.location_name} · {formatDate(nearestBooking.date)} · {nearestBooking.time_slot}</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsNextBookingExpanded((prev) => !prev)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/55 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background/75 sm:hidden dark:bg-background/60" aria-expanded={isNextBookingExpanded}>
                {isNextBookingExpanded ? 'Hide details' : 'Show details'}
                <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 transition-transform ${isNextBookingExpanded ? 'rotate-180' : ''}`} aria-hidden="true"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className={`${isNextBookingExpanded ? 'mt-4 grid gap-2 text-sm' : 'hidden'} sm:mt-4 sm:grid sm:gap-2 sm:text-sm sm:grid-cols-3 lg:min-w-[420px]`}>
                <div className="rounded-xl border border-border/70 bg-background/55 p-3 dark:bg-background/60"><p className="text-xs uppercase tracking-wide text-muted-foreground">Tour</p><p className="mt-1 font-semibold text-foreground">{nearestBooking.trail_type === 'mtb' ? 'MTB' : 'Paved'} · {nearestBooking.duration_hours}h</p></div>
                <div className="rounded-xl border border-border/70 bg-background/55 p-3 dark:bg-background/60"><p className="text-xs uppercase tracking-wide text-muted-foreground">Payment</p><p className="mt-1 font-semibold text-foreground">{formatPrice(nearestBooking.total_price)}</p></div>
                <div className="rounded-xl border border-border/70 bg-background/55 p-3 dark:bg-background/60"><p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p><p className="mt-1 font-semibold capitalize text-green-700 dark:text-green-300">{nearestBooking.status}</p></div>
              </div>
            </div>
          </div>
        )}

        {/* Stats cards */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:mb-5 lg:grid-cols-6">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className={[
                'group relative flex min-h-[104px] flex-col justify-between overflow-hidden rounded-2xl border p-4 shadow-[0_10px_28px_rgba(0,0,0,0.12)] transition-colors sm:min-h-[118px]',
                stat.mobileSpanClassName ?? 'col-span-1',
                'sm:col-span-1 lg:col-span-2',
                stat.className,
                stat.href ? 'cursor-pointer hover:opacity-90' : '',
              ].join(' ')}
              onClick={stat.href ? () => (window.location.href = stat.href!) : undefined}
            >
              {stat.featured && (
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.07),transparent_45%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_42%)]" />
              )}
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
              </div>
              <div className="relative mt-5 flex items-end justify-between gap-3">
                <p className={['text-[2rem] font-bold leading-none sm:text-[2rem]', 'text-foreground', stat.valueClassName ?? ''].join(' ')}>
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Failed balance alert */}
        {stats.balanceFailed > 0 && (
          <div className="mb-6 rounded-2xl border border-red-500/35 bg-gradient-to-r from-red-500/[0.08] via-card/95 to-card/90 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.12)] sm:mb-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">Payment Issues</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  {stats.balanceFailed} booking{stats.balanceFailed > 1 ? 's have' : ' has'} a failed balance charge
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">Review these bookings and retry the payment if needed.</p>
              </div>
              <div className="shrink-0 rounded-2xl border border-red-500/25 bg-red-500/[0.08] px-5 py-4 text-left sm:min-w-[140px] sm:text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">Issues</p>
                <p className="mt-2 text-3xl font-bold leading-none text-red-400">{stats.balanceFailed}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{isLeadsView ? 'Leads' : 'Bookings'}</p>
            <p className="text-xs text-muted-foreground sm:hidden">Swipe for more</p>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-2 sm:grid sm:min-w-0 sm:grid-cols-3 lg:grid-cols-6">
              {STATUS_OPTIONS.map((s) => (
                <a
                  key={s}
                  href={filterUrl(s)}
                  className={`rounded-full border px-4 py-2 text-center text-sm font-medium capitalize transition-colors sm:w-full ${
                    currentStatus === s
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  {s === 'all' ? 'All Bookings' : s}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── LEADS VIEW ─────────────────────────────────────────────────────── */}
        <div className="mb-4">
          <div className="rounded-2xl border border-border/70 bg-card/80 p-2 shadow-[0_10px_24px_rgba(0,0,0,0.1)]">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={
                isLeadsView
                  ? 'Search leads by name, email, phone, ZIP, source, trail, or location'
                  : 'Search bookings by customer, email, phone, ZIP, trail, location, or status'
              }
              className="w-full rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-green-500/40"
            />
          </div>
        </div>

        {isLeadsView && (
          <>
            <div className="hidden overflow-hidden rounded-lg border border-border bg-card sm:block">
              {filteredLeads.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  {normalizedSearch ? 'No leads match your search.' : 'No active leads.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        {['Contact', 'Trail', 'Source', 'Funnel Stage', 'Follow-Up', 'Last Active', 'Actions'].map((h) => (
                          <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${h === 'Actions' || h === 'Source' ? 'text-center' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredLeads.map((lead) => {
                        const followUpDisplay = getLeadFollowUpDisplay(lead);
                        const nextPending = getLeadNextPendingStep(lead);
                        const canSendFollowUp = canStartLeadFollowUp(lead);

                        return (
                        <Fragment key={lead.id}>
                        <tr className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{lead.full_name}</div>
                            <div className="text-xs text-muted-foreground">{lead.email}</div>
                            {lead.phone && <div className="mt-0.5 text-xs text-muted-foreground">{lead.phone}</div>}
                            {(lead.zip_code || lead.heard_about_us) && (
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {lead.zip_code && <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">ZIP {lead.zip_code}</span>}
                                {lead.heard_about_us && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{lead.heard_about_us}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-foreground/80 capitalize">
                            {lead.selected_trail_type ?? '—'}
                            {lead.selected_location_name && (
                              <div className="text-xs text-muted-foreground">{lead.selected_location_name}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            {lead.utm_source ? (
                              <div className="flex flex-col items-center">
                                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">{lead.utm_source}</span>
                                {lead.utm_campaign && <div className="mt-1 text-xs text-muted-foreground">{lead.utm_campaign}</div>}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {lead.last_step_completed ? (
                              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                                {STEP_LABELS[lead.last_step_completed] ?? lead.last_step_completed}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1.5">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${followUpDisplay.badgeClass}`}>
                                {followUpDisplay.label}
                              </span>
                              <p className="max-w-[190px] text-xs text-muted-foreground">
                                {nextPending
                                  ? `Next ${formatStepKey(nextPending.step_key)} ${formatDateTime(nextPending.scheduled_for)}`
                                  : followUpDisplay.detail}
                              </p>
                              <LeadProgressBar lead={lead} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{timeAgo(lead.last_activity_at)}</span>
                              <LeadFreshness lastActivityAt={lead.last_activity_at} />
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-col items-center gap-2 text-center">
                              <button
                                onClick={() => toggleLead(lead.id)}
                                className={`inline-flex w-32 items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  expandedLeads.has(lead.id)
                                    ? 'border-foreground/20 bg-foreground text-background hover:bg-foreground/90'
                                    : 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                                }`}
                              >
                                {expandedLeads.has(lead.id) ? 'Hide details' : 'View details'}
                              </button>
                              <button onClick={() => handleSendLeadFollowUp(lead.id)} disabled={sendingLeadId === lead.id || !canSendFollowUp} className="inline-flex w-32 items-center justify-center rounded-md border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-300 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                                {sendingLeadId === lead.id ? 'Sending...' : canSendFollowUp ? 'Send Follow-Up' : followUpDisplay.label}
                              </button>
                              {leadFollowUpStatus[lead.id] && <p className="text-xs text-muted-foreground">{leadFollowUpStatus[lead.id]}</p>}
                            </div>
                          </td>
                        </tr>
                        {expandedLeads.has(lead.id) && (
                          <tr className="bg-muted/10">
                            <td colSpan={7} className="px-4 py-4">
                              <LeadDetailPanel lead={lead} />
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Mobile leads */}
            <div className="space-y-3 sm:hidden">
              {filteredLeads.length === 0 ? (
                <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-10 text-center text-sm text-muted-foreground">
                  {normalizedSearch ? 'No leads match your search.' : 'No active leads.'}
                </div>
              ) : (
                filteredLeads.map((lead) => {
                  const followUpDisplay = getLeadFollowUpDisplay(lead);
                  const nextPending = getLeadNextPendingStep(lead);
                  const canSendFollowUp = canStartLeadFollowUp(lead);

                  return (
                  <div key={lead.id} className="rounded-2xl border border-border/80 bg-card/95 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{lead.full_name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.email}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <LeadFreshness lastActivityAt={lead.last_activity_at} />
                        {lead.selected_trail_type && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{lead.selected_trail_type}</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {lead.heard_about_us && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{lead.heard_about_us}</span>}
                      {lead.utm_source && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">{lead.utm_source}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${followUpDisplay.badgeClass}`}>
                        {followUpDisplay.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
                      {lead.last_step_completed ? (
                        <span className="text-[11px] text-muted-foreground">{STEP_LABELS[lead.last_step_completed] ?? lead.last_step_completed}</span>
                      ) : <span />}
                      <span className="text-[11px] text-muted-foreground">{timeAgo(lead.last_activity_at)}</span>
                    </div>
                    <div className="mt-2">
                      <LeadProgressBar lead={lead} />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {nextPending
                        ? `Next ${formatStepKey(nextPending.step_key)} ${formatDateTime(nextPending.scheduled_for)}`
                        : followUpDisplay.detail}
                    </p>
                    <div className="mt-3 flex w-full gap-2">
                      <button
                        onClick={() => toggleLead(lead.id)}
                        className={`inline-flex flex-1 items-center justify-center rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors ${
                          expandedLeads.has(lead.id)
                            ? 'border-foreground/20 bg-foreground text-background hover:bg-foreground/90'
                            : 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                        }`}
                      >
                        {expandedLeads.has(lead.id) ? 'Hide details' : 'View details'}
                      </button>
                      <button onClick={() => handleSendLeadFollowUp(lead.id)} disabled={sendingLeadId === lead.id || !canSendFollowUp} className="inline-flex flex-1 items-center justify-center rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-[11px] font-semibold text-green-300 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                        {sendingLeadId === lead.id ? 'Sending...' : canSendFollowUp ? 'Send Follow-Up' : followUpDisplay.label}
                      </button>
                    </div>
                    {leadFollowUpStatus[lead.id] && <p className="mt-2 text-[11px] text-muted-foreground">{leadFollowUpStatus[lead.id]}</p>}
                    {expandedLeads.has(lead.id) && (
                      <div className="mt-3">
                        <LeadDetailPanel lead={lead} />
                      </div>
                    )}
                  </div>
                )})
              )}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">Showing up to 100 most recent leads</p>
          </>
        )}

        {/* ── BOOKINGS VIEW ──────────────────────────────────────────────────── */}
        {!isLeadsView && (
          <>
            {/* Mobile booking cards */}
            <div className="space-y-3 sm:hidden">
              {filteredBookings.length === 0 ? (
                <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-10 text-center text-sm text-muted-foreground">
                  {normalizedSearch ? 'No bookings match your search.' : 'No bookings found.'}
                </div>
              ) : (
                filteredBookings.map((booking) => {
                  const attribution = getBookingAttributionMeta(booking);

                  return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => setSelectedMobileBookingId(booking.id)}
                    className="w-full rounded-2xl border border-border/80 bg-card/95 p-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition-all active:scale-[0.99] active:border-green-500/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{booking.customer_name}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{formatDate(booking.date)} · {booking.time_slot}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${STATUS_COLORS[booking.status] ?? 'bg-muted text-muted-foreground'}`}>{booking.status}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
                      <div className="min-w-0 space-y-2">
                        <p className="truncate text-sm text-foreground">{booking.location_name}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>{booking.trail_type === 'mtb' ? 'MTB' : 'Paved'}</span>
                          <span>·</span>
                          <span>{booking.duration_hours}hr</span>
                          <span>·</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {(() => {
                            const riders = buildRiderDetails(booking);
                            const missingCount = riders.filter((rider) => rider.needsSizing).length;
                            return `${summarizeBikeMix(riders)} · ${riders.length} rider${riders.length > 1 ? 's' : ''}${missingCount > 0 ? ` · ${missingCount} size missing` : ''}`;
                          })()}
                        </p>
                      </div>
                      <div className="space-y-2 text-right">
                        <p className="text-sm font-semibold text-foreground">{formatPrice(booking.total_price)}</p>
                        <div className="flex flex-col items-end gap-1">
                          <WaiverBadge records={booking.waiver_records} />
                          {booking.remaining_balance_status === 'failed' ? (
                            <span className="text-[11px] font-medium text-red-400">Balance failed</span>
                          ) : booking.remaining_balance_status === 'paid' ? (
                            <span className="text-[11px] font-medium text-green-400">Paid in full</span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Balance pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                      <div className="flex min-w-0 flex-wrap gap-1.5">
                        {booking.zip_code && <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">ZIP {booking.zip_code}</span>}
                        {booking.marketing_source && <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] capitalize text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{booking.marketing_source}</span>}
                        {booking.lead_id && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Converted lead</span>}
                        {attribution.isEmailConversion && <span className="rounded-full bg-purple-100 px-2 py-1 text-[11px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">Email Conversion</span>}
                        {attribution.templateKey && <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{attribution.templateKey}</span>}
                      </div>
                      <div className="text-right">
                        {(attribution.stepKey || attribution.flow) && (
                          <div className="mb-1 text-[11px] text-muted-foreground">
                            {[attribution.stepKey ? `Step ${attribution.stepKey}` : null, attribution.flow].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        <span className="text-xs font-medium text-green-400">Open details</span>
                      </div>
                    </div>
                  </button>
                )})
              )}
            </div>

            {/* Desktop bookings table */}
            <div className="hidden overflow-hidden rounded-lg border border-border bg-card sm:block">
              {filteredBookings.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  {normalizedSearch ? 'No bookings match your search.' : 'No bookings found.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        {['Customer', 'Location', 'Date', 'Riders & Bikes', 'Payment', 'Waivers', 'Status', 'Actions'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredBookings.map((booking) => {
                        const attribution = getBookingAttributionMeta(booking);

                        return (
                        <tr key={booking.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{booking.customer_name}</div>
                            <div className="text-xs text-muted-foreground">{booking.customer_email}</div>
                            {booking.customer_phone && <div className="mt-0.5 text-xs text-muted-foreground">{booking.customer_phone}</div>}
                            {(booking.zip_code || booking.marketing_source) && (
                              <div className="mt-1 flex flex-wrap gap-2">
                                {booking.zip_code && <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">ZIP {booking.zip_code}</span>}
                                {booking.marketing_source && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{booking.marketing_source}</span>}
                                {booking.lead_id && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Converted lead</span>}
                                {attribution.isEmailConversion && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">Email Conversion</span>}
                                {attribution.templateKey && <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{attribution.templateKey}</span>}
                              </div>
                            )}
                            {(attribution.stepKey || attribution.flow) && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {[attribution.stepKey ? `Step ${attribution.stepKey}` : null, attribution.flow].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-foreground/80">{booking.location_name}</td>
                          <td className="px-4 py-3 text-foreground/80"><div>{formatDate(booking.date)}</div><div className="text-xs text-muted-foreground">{booking.time_slot}</div></td>
                          <td className="px-4 py-3 text-foreground/80">
                            <div className="flex items-center gap-2">
                              <span>{booking.trail_type === 'mtb' ? 'MTB' : 'Paved'} · {booking.duration_hours}h</span>
                              {(() => {
                                const riders = buildRiderDetails(booking);
                                const missingCount = riders.filter((rider) => rider.needsSizing).length;
                                return (
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${missingCount > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
                                    {missingCount > 0 ? `${missingCount} size missing` : 'Sizing ready'}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {summarizeBikeMix(buildRiderDetails(booking))}
                            </div>
                            <div className="mt-2 space-y-1">
                              {buildRiderDetails(booking).map((rider) => (
                                <div key={rider.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                                  <span className="font-medium text-foreground">{rider.label}:</span>
                                  <span className="text-foreground/80">{rider.name}</span>
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{rider.bikeLabel}</span>
                                  <span className={`rounded px-1.5 py-0.5 ${rider.needsSizing ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>
                                    Height {rider.heightLabel}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{formatPrice(booking.total_price)}</div>
                            {booking.deposit_amount && <div className="mt-0.5 text-xs text-muted-foreground">Deposit: {formatPrice(booking.deposit_amount)}</div>}
                            <div className="mt-1 space-y-0.5">
                              <div><BalanceBadge status={booking.remaining_balance_status} amount={booking.remaining_balance_amount} dueAt={booking.remaining_balance_due_at} /></div>
                              {booking.remaining_balance_status === 'failed' && (
                                <div className="pt-1">
                                  <button onClick={() => handleRetryCharge(booking.id)} disabled={retrying === booking.id} className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60">{retrying === booking.id ? 'Retrying...' : 'Retry'}</button>
                                  {retryErrors[booking.id] && <p className="mt-0.5 text-xs text-red-500">{retryErrors[booking.id]}</p>}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1.5">
                              <WaiverBadge records={booking.waiver_records} />
                              {booking.waiver_records.length > 0 && <button onClick={() => toggleWaivers(booking.id)} className="block text-xs text-muted-foreground transition-colors hover:text-foreground">{expandedWaivers.has(booking.id) ? 'Hide' : 'View'}</button>}
                              {expandedWaivers.has(booking.id) && <div className="mt-2 min-w-[220px]"><WaiverPanel records={booking.waiver_records} /></div>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[booking.status] ?? 'bg-muted text-muted-foreground'}`}>{booking.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            {booking.review_request_enrollment && (
                              <div className="mb-2 text-[11px] text-muted-foreground">
                                {getReviewRequestStatusLabel(booking.review_request_enrollment)}
                              </div>
                            )}
                            <select value={booking.status} disabled={updating === booking.id} onChange={(e) => handleStatusChange(booking.id, e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50">
                              <option value="confirmed">confirmed</option>
                              <option value="completed">completed</option>
                              <option value="cancelled">cancelled</option>
                              <option value="refunded">refunded</option>
                            </select>
                            {booking.status === 'completed' &&
                              booking.review_request_enrollment &&
                              booking.review_request_enrollment.status !== 'reviewed' && (
                                <button
                                  onClick={() => handleMarkReviewReceived(booking.id)}
                                  disabled={markingReviewBookingId === booking.id}
                                  className="mt-2 block rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs text-blue-300 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
                                >
                                  {markingReviewBookingId === booking.id ? 'Saving...' : 'Mark Review Received'}
                                </button>
                              )}
                            <button onClick={() => setDeleteDialog({ id: booking.id, customerName: booking.customer_name, locationName: booking.location_name, date: booking.date })} disabled={deleting === booking.id} className="mt-2 rounded border border-red-500/40 bg-transparent px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50">{deleting === booking.id ? 'Deleting...' : 'Delete'}</button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">Showing up to 100 most recent bookings</p>
          </>
        )}
      </div>
    </div>
  );
}
