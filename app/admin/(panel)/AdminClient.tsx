'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getBookingProgressMeta,
  PERSISTED_STEP_LABELS,
} from '@/lib/booking-flow-progress';
import {
  formatFloridaCalendarDate,
  formatFloridaDateTime,
} from '@/lib/display-time';
import type { SkillLevel, TrailType } from '@/types/booking';

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

interface TrashedBooking {
  id: string;
  status: string;
  date: string;
  location_name: string;
  total_price: number;
  deposit_amount: number | null;
  deposit_payment_status: string | null;
  deleted_at: string;
  deleted_by: string | null;
  created_at: string;
}

interface TrashedLead {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  selected_trail_type: string | null;
  selected_location_name: string | null;
  deleted_at: string;
  deleted_by: string | null;
  created_at: string;
}

interface Props {
  leads: Lead[];
  currentStatus: string;
  initialLeadId?: string | null;
  trashedBookings?: TrashedBooking[];
  trashedLeads?: TrashedLead[];
}

interface DeleteLeadDialogState {
  id: string;
  fullName: string;
  trailType: TrailType | null;
  lastActivityAt: string;
}

// The bookings views moved to /admin/bookings (phase 2, step 3b); leads and
// trash follow in step 3c.
const STATUS_OPTIONS = ['leads', 'trash'];

const STEP_LABELS: Record<string, string> = {
  ...PERSISTED_STEP_LABELS,
  addons_selected: 'Add-ons viewed',
  waiver_completed: 'Waiver signed',
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatDate(d: string) {
  return formatFloridaCalendarDate(d);
}

function formatDateTime(iso: string) {
  return formatFloridaDateTime(iso);
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

function formatBikeLabel(bikeRental: string | null | undefined): string {
  if (!bikeRental || bikeRental === 'none') return 'BYOB';
  if (bikeRental === 'electric') return 'E-Bike';
  return 'Regular Bike';
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
            <p className="mt-1 text-sm text-muted-foreground">{timeAgo(lead.last_activity_at)} - {formatDateTime(lead.last_activity_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminClient({ leads, currentStatus, initialLeadId = null, trashedBookings = [], trashedLeads = [] }: Props) {
  const router = useRouter();
  const handleUnauthorized = useCallback(() => {
    router.push('/admin/login?expired=1');
  }, [router]);

  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [localTrashedBookings, setLocalTrashedBookings] = useState<TrashedBooking[]>(trashedBookings);
  const [localTrashedLeads, setLocalTrashedLeads] = useState<TrashedLead[]>(trashedLeads);
  const [trashActionId, setTrashActionId] = useState<string | null>(null);
  const [purgeDialog, setPurgeDialog] = useState<{ type: 'booking' | 'lead'; id: string; label: string; sublabel: string } | null>(null);
  const [leadDeleteDialog, setLeadDeleteDialog] = useState<DeleteLeadDialogState | null>(null);
  const [localLeads, setLocalLeads] = useState(leads);
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());
  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);
  const [leadFollowUpStatus, setLeadFollowUpStatus] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');


  const isLeadsView = currentStatus === 'leads';
  const isTrashView = currentStatus === 'trash';
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
  useEffect(() => {
    if (!initialLeadId) return;
    if (!localLeads.some((lead) => lead.id === initialLeadId)) return;

    setExpandedLeads((prev) => {
      if (prev.has(initialLeadId)) return prev;
      const next = new Set(prev);
      next.add(initialLeadId);
      return next;
    });
  }, [initialLeadId, localLeads]);

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
      if (res.status === 401) { handleUnauthorized(); return; }
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

  const handleDeleteLead = async (leadId: string) => {
    setDeletingLeadId(leadId);
    setLeadFollowUpStatus((prev) => ({ ...prev, [leadId]: '' }));
    try {
      const res = await fetch('/api/admin/delete-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });

      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLocalLeads((prev) => prev.filter((lead) => lead.id !== leadId));
        router.refresh();
        setExpandedLeads((prev) => {
          const next = new Set(prev);
          next.delete(leadId);
          return next;
        });
        setLeadFollowUpStatus((prev) => {
          const next = { ...prev };
          delete next[leadId];
          return next;
        });
      } else {
        setLeadFollowUpStatus((prev) => ({ ...prev, [leadId]: data.error ?? 'Failed to delete lead' }));
      }
    } finally {
      setDeletingLeadId(null);
      setLeadDeleteDialog(null);
    }
  };
  const handleRestoreBooking = async (bookingId: string) => {
    setTrashActionId(bookingId);
    try {
      const res = await fetch('/api/admin/restore-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) {
        setLocalTrashedBookings((prev) => prev.filter((b) => b.id !== bookingId));
        router.refresh(); // a restored booking counts in the stats again
      }
    } finally {
      setTrashActionId(null);
    }
  };

  const handlePurgeBooking = async (bookingId: string) => {
    setTrashActionId(bookingId);
    try {
      const res = await fetch('/api/admin/purge-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setLocalTrashedBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } finally {
      setTrashActionId(null);
    }
  };

  const handleRestoreLead = async (leadId: string) => {
    setTrashActionId(leadId);
    try {
      const res = await fetch('/api/admin/restore-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) {
        setLocalTrashedLeads((prev) => prev.filter((l) => l.id !== leadId));
        router.refresh();
      }
    } finally {
      setTrashActionId(null);
    }
  };

  const handlePurgeLead = async (leadId: string) => {
    setTrashActionId(leadId);
    try {
      const res = await fetch('/api/admin/purge-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setLocalTrashedLeads((prev) => prev.filter((l) => l.id !== leadId));
    } finally {
      setTrashActionId(null);
    }
  };

  const filterUrl = (status: string) => `/admin?status=${status}`;

  return (
    <div>
      <div className="relative">
        {leadDeleteDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => (deletingLeadId ? undefined : setLeadDeleteDialog(null))} />
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-card text-card-foreground shadow-[0_0_0_1px_rgba(239,68,68,0.08),0_20px_80px_rgba(0,0,0,0.55)]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/70 to-transparent" />
              <div className="p-6">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.66 18h16.68a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-foreground">Delete Lead?</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This will permanently remove <span className="font-semibold text-foreground">{leadDeleteDialog.fullName}</span>, along with related follow-up records, lead sessions, pending bookings, and linked waiver records.
                </p>
                <div className="mt-4 rounded-xl border border-border bg-background/60 p-4 text-sm">
                  <p className="font-medium capitalize text-foreground">{leadDeleteDialog.trailType ?? 'Lead'}</p>
                  <p className="mt-1 text-muted-foreground">Last active {formatDateTime(leadDeleteDialog.lastActivityAt)}</p>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button onClick={() => setLeadDeleteDialog(null)} disabled={!!deletingLeadId} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">Keep Lead</button>
                  <button onClick={() => handleDeleteLead(leadDeleteDialog.id)} disabled={!!deletingLeadId} className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50">
                    {deletingLeadId === leadDeleteDialog.id ? 'Deleting...' : 'Delete Permanently'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {purgeDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => (trashActionId ? undefined : setPurgeDialog(null))} />
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-card text-card-foreground shadow-[0_0_0_1px_rgba(239,68,68,0.08),0_20px_80px_rgba(0,0,0,0.55)]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/70 to-transparent" />
              <div className="p-6">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  Delete {purgeDialog.type === 'booking' ? 'Booking' : 'Lead'} Forever?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This will <span className="font-semibold text-red-600 dark:text-red-300">permanently remove</span> this record from the database. This action cannot be undone.
                </p>
                <div className="mt-4 rounded-xl border border-border bg-background/60 p-4 text-sm">
                  <p className="font-medium text-foreground">{purgeDialog.label}</p>
                  <p className="mt-1 text-muted-foreground">{purgeDialog.sublabel}</p>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => setPurgeDialog(null)}
                    disabled={!!trashActionId}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Keep
                  </button>
                  <button
                    onClick={() => {
                      if (purgeDialog.type === 'booking') handlePurgeBooking(purgeDialog.id);
                      else handlePurgeLead(purgeDialog.id);
                      setPurgeDialog(null);
                    }}
                    disabled={!!trashActionId}
                    className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {trashActionId ? 'Deleting...' : 'Delete Forever'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{isTrashView ? 'Trash' : 'Leads'}</p>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-2 sm:grid sm:min-w-0 sm:grid-cols-2">
              {STATUS_OPTIONS.map((s) => (
                <a
                  key={s}
                  href={filterUrl(s)}
                  className={`rounded-full border px-4 py-2 text-center text-sm font-medium capitalize transition-colors sm:w-full ${
                    currentStatus === s
                      ? s === 'trash'
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-green-600 bg-green-600 text-white'
                      : s === 'trash'
                        ? 'border-red-500/30 bg-card text-red-400 hover:border-red-500/60'
                        : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  {s === 'trash' ? 'Trash' : s}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* â"€â"€ SEARCH BAR â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        {!isTrashView && (
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
        )}

        {isTrashView && (
          <div className="space-y-6">
            {/* Trashed Bookings */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Archived Bookings ({localTrashedBookings.length})</h3>
              {localTrashedBookings.length === 0 ? (
                <div className="rounded-xl border border-border bg-card/60 py-10 text-center text-sm text-muted-foreground">No archived bookings.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card/80">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">Booking</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Payment</th>
                        <th className="px-4 py-3 text-left font-medium">Archived by</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {localTrashedBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{b.location_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{b.status}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(b.date)}</td>
                          <td className="px-4 py-3">
                            <p className="text-foreground">{formatPrice(b.total_price)}</p>
                            {b.deposit_payment_status === 'paid' && (
                              <p className="text-xs text-green-400">Deposit paid: {formatPrice(b.deposit_amount ?? 0)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">{b.deleted_by ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(b.deleted_at)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleRestoreBooking(b.id)}
                                disabled={trashActionId === b.id}
                                className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-300 transition-colors hover:bg-green-500/20 disabled:opacity-50"
                              >
                                {trashActionId === b.id ? '...' : 'Restore'}
                              </button>
                              <button
                                onClick={() => setPurgeDialog({ type: 'booking', id: b.id, label: b.location_name, sublabel: formatDate(b.date) })}
                                disabled={trashActionId === b.id}
                                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                              >
                                Delete Forever
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Trashed Leads */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Archived Leads ({localTrashedLeads.length})</h3>
              {localTrashedLeads.length === 0 ? (
                <div className="rounded-xl border border-border bg-card/60 py-10 text-center text-sm text-muted-foreground">No archived leads.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card/80">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">Lead</th>
                        <th className="px-4 py-3 text-left font-medium">Trail / Location</th>
                        <th className="px-4 py-3 text-left font-medium">Archived by</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {localTrashedLeads.map((l) => (
                        <tr key={l.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{l.full_name}</p>
                            <p className="text-xs text-muted-foreground">{l.email}</p>
                            {l.phone && <p className="text-xs text-muted-foreground">{l.phone}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-muted-foreground capitalize">{l.selected_trail_type ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">{l.selected_location_name ?? '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">{l.deleted_by ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(l.deleted_at)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleRestoreLead(l.id)}
                                disabled={trashActionId === l.id}
                                className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-300 transition-colors hover:bg-green-500/20 disabled:opacity-50"
                              >
                                {trashActionId === l.id ? '...' : 'Restore'}
                              </button>
                              <button
                                onClick={() => setPurgeDialog({ type: 'lead', id: l.id, label: l.full_name, sublabel: l.email })}
                                disabled={trashActionId === l.id}
                                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                              >
                                Delete Forever
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {!isTrashView && isLeadsView && (
          <>
            <div className="hidden overflow-hidden rounded-lg border border-border bg-card sm:block">
              {filteredLeads.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  {normalizedSearch ? 'No leads match your search.' : 'No active leads.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-sm">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</th>
                        <th className="w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trail</th>
                        <th className="w-[10%] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source</th>
                        <th className="w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Funnel Stage</th>
                        <th className="w-[21%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow-Up</th>
                        <th className="w-[10%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Active</th>
                        <th className="w-[17%] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
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
                          <td className="px-4 py-3 align-top text-foreground/80 capitalize">
                            {lead.selected_trail_type ?? '-'}
                            {lead.selected_location_name && (
                              <div className="text-xs text-muted-foreground">{lead.selected_location_name}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-center">
                            {lead.utm_source ? (
                              <div className="flex flex-col items-center">
                                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">{lead.utm_source}</span>
                                {lead.utm_campaign && <div className="mt-1 text-xs text-muted-foreground">{lead.utm_campaign}</div>}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {lead.last_step_completed ? (
                              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                                {STEP_LABELS[lead.last_step_completed] ?? lead.last_step_completed}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1.5">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${followUpDisplay.badgeClass}`}>
                                {followUpDisplay.label}
                              </span>
                              <p className="max-w-[240px] text-xs leading-5 text-muted-foreground">
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
                              <button onClick={() => setLeadDeleteDialog({ id: lead.id, fullName: lead.full_name, trailType: lead.selected_trail_type, lastActivityAt: lead.last_activity_at })} disabled={deletingLeadId === lead.id} className="inline-flex w-32 items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                                {deletingLeadId === lead.id ? 'Deleting...' : 'Delete Lead'}
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
                    <div className="mt-3 grid w-full grid-cols-2 gap-2">
                      <button
                        onClick={() => toggleLead(lead.id)}
                        className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors ${
                          expandedLeads.has(lead.id)
                            ? 'border-foreground/20 bg-foreground text-background hover:bg-foreground/90'
                            : 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                        }`}
                      >
                        {expandedLeads.has(lead.id) ? 'Hide details' : 'View details'}
                      </button>
                      <button onClick={() => handleSendLeadFollowUp(lead.id)} disabled={sendingLeadId === lead.id || !canSendFollowUp} className="inline-flex items-center justify-center rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-[11px] font-semibold text-green-300 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                        {sendingLeadId === lead.id ? 'Sending...' : canSendFollowUp ? 'Send Follow-Up' : followUpDisplay.label}
                      </button>
                      <button onClick={() => setLeadDeleteDialog({ id: lead.id, fullName: lead.full_name, trailType: lead.selected_trail_type, lastActivityAt: lead.last_activity_at })} disabled={deletingLeadId === lead.id} className="col-span-2 inline-flex items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                        {deletingLeadId === lead.id ? 'Deleting...' : 'Delete Lead'}
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

      </div>
    </div>
  );
}
