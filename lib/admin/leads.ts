// The leads list of the admin (/admin/leads): the DB records, the view and
// search that live in the URL (§4.7), the row the list renders and the drawer's
// quick view. Pure — the queries are in ./loaders.ts.
//
// A lead is someone who started a booking and hasn't paid. Converted ones (by
// status, a booking link or a payment on one of their bookings) never show here.
import {
  formatRelative,
  withParam,
  type FilterSheetOption,
  type Metric,
  type SearchParamsInput,
  type StatusMeta,
} from '@/components/kit';
import { getBookingProgressMeta, PERSISTED_STEP_LABELS } from '@/lib/booking-flow-progress';
import { FLORIDA_MTB_TIME_ZONE, formatFloridaCalendarDate, formatFloridaDateTime, formatTourTime } from '@/lib/display-time';
import type { SkillLevel, TrailType } from '@/types/booking';
import type { Fact } from './bookings';
import { dropParam, parseUuid, single, type Raw } from './params';
import { FOLLOW_UP_STEP, LEAD_FOLLOW_UP, LEAD_FRESHNESS } from './status-meta';

// ─── Records ────────────────────────────────────────────────────────────────

export type LeadRecord = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  zip_code: string | null;
  heard_about_us: string | null;
  selected_trail_type: TrailType | null;
  selected_skill_level: SkillLevel | null;
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
  converted_at: string | null;
  lost_at: string | null;
};

export type FollowUpEnrollment = {
  id: string;
  lead_id: string;
  status: string;
  enrolled_at: string;
  next_step_due_at: string | null;
  lost_at: string | null;
  stop_reason: string | null;
  webhook_triggered_at: string | null;
};

export type FollowUpStep = {
  id: string;
  enrollment_id: string;
  step_number: number;
  step_key: string;
  scheduled_for: string;
  sent_at: string | null;
  status: string;
  skip_reason: string | null;
};

/** The newest follow-up of each lead. `enrollments` comes newest first. */
export function latestEnrollmentByLead(enrollments: readonly FollowUpEnrollment[]): Map<string, FollowUpEnrollment> {
  const latest = new Map<string, FollowUpEnrollment>();
  for (const e of enrollments) if (!latest.has(e.lead_id)) latest.set(e.lead_id, e);
  return latest;
}

/** Each enrollment's emails, in sequence order. */
export function stepsByEnrollment(steps: readonly FollowUpStep[]): Map<string, FollowUpStep[]> {
  const byEnrollment = new Map<string, FollowUpStep[]>();
  for (const step of [...steps].sort((a, b) => a.step_number - b.step_number)) {
    byEnrollment.set(step.enrollment_id, [...(byEnrollment.get(step.enrollment_id) ?? []), step]);
  }
  return byEnrollment;
}

// ─── The view in the URL: ?view= ?q= ?page= ?lead= ─────────────────────────

export const LEAD_VIEWS = ['open', 'hot', 'following', 'lost'] as const;
export type LeadView = (typeof LEAD_VIEWS)[number];
export type LeadCounts = Record<LeadView, number>;

export function parseLeadView(raw: Raw): LeadView {
  const value = single(raw);
  return (LEAD_VIEWS as readonly string[]).includes(value ?? '') ? (value as LeadView) : 'open';
}

export const HOT_HOURS = 24;
const WARM_HOURS = 72;

/** Where "hot" starts: active since this instant. */
export function hotSince(now: Date): string {
  return new Date(now.getTime() - HOT_HOURS * 3_600_000).toISOString();
}

const VIEW_LABEL: Record<LeadView, string> = {
  open: 'Open',
  hot: 'Hot',
  following: 'Following up',
  lost: 'Lost',
};

const VIEW_SUB: Record<LeadView, string> = {
  open: 'Started, not booked',
  hot: `Active in the last ${HOT_HOURS}h`,
  following: 'Emails on their way',
  lost: 'Follow-up ran out',
};

export const LEAD_VIEW_TITLE: Record<LeadView, string> = {
  open: 'Open leads',
  hot: `Active in the last ${HOT_HOURS} hours`,
  following: 'In a follow-up sequence',
  lost: 'Lost leads',
};

/** The list's URL with one view, keeping the search and dropping the drawer and the page. */
export function leadViewHref(path: string, params: SearchParamsInput, view: LeadView): string {
  return withParam(path, dropParam(params, 'lead'), 'view', view === 'open' ? null : view);
}

/** The strip doubles as the view filter on a wide screen (§4.7). */
export function leadViewMetrics(counts: LeadCounts, active: LeadView, path: string, params: SearchParamsInput): Metric[] {
  return LEAD_VIEWS.map((view) => ({
    key: view,
    label: VIEW_LABEL[view],
    value: String(counts[view]),
    sub: VIEW_SUB[view],
    href: leadViewHref(path, params, view),
    active: view === active,
  }));
}

/** The same filter on the phone, in a FilterSheet. */
export function leadViewOptions(counts: LeadCounts, active: LeadView, path: string, params: SearchParamsInput): FilterSheetOption[] {
  return LEAD_VIEWS.map((view) => ({
    value: view === 'open' ? null : view,
    label: VIEW_LABEL[view],
    count: counts[view],
    href: leadViewHref(path, params, view),
  }));
}

/** What an empty list says: what's missing and how it fills (§8.5). */
export function leadsEmpty(view: LeadView, q: string): string {
  if (q) {
    return `No leads match “${q}”. The search looks at the name, email, phone, ZIP, how they heard about you, the UTM source and campaign, the trail and the location.`;
  }
  return {
    open: 'No open leads. A lead appears here when someone leaves their contact details in the booking flow and doesn’t pay.',
    hot: `Nobody active in the last ${HOT_HOURS} hours. A lead shows up here while they are still in the booking flow.`,
    following: 'No follow-up running. Start one from a lead’s details; it sends three emails over a week.',
    lost: 'No lost leads. A lead lands here when its follow-up runs out without a booking.',
  }[view];
}

/**
 * The old links to the leads and the trash (`/admin?status=leads&leadId=…`,
 * `/admin?status=trash`): where they go now, or null.
 */
export function legacyLeadsUrl(status: Raw, leadId: Raw): string | null {
  const value = single(status);
  if (value === 'trash' && !single(leadId)) return '/admin/trash';
  if (value !== 'leads' && !single(leadId)) return null;
  const id = parseUuid(leadId);
  return id ? `/admin/leads?lead=${id}` : '/admin/leads';
}

// ─── Freshness, stage, follow-up ────────────────────────────────────────────

/** Hot within a day, warm within three; older says nothing. */
export function leadFreshness(lastActivityAt: string, now: Date): StatusMeta | null {
  const hours = (now.getTime() - new Date(lastActivityAt).getTime()) / 3_600_000;
  if (!Number.isFinite(hours)) return null;
  if (hours < HOT_HOURS) return LEAD_FRESHNESS.hot;
  if (hours < WARM_HOURS) return LEAD_FRESHNESS.warm;
  return null;
}

const STEP_LABELS: Record<string, string> = {
  ...PERSISTED_STEP_LABELS,
  addons_selected: 'Add-ons viewed',
  waiver_completed: 'Waiver signed',
};

/** The last step of the booking flow they reached. */
export function stageLabel(lead: Pick<LeadRecord, 'last_step_completed'>): string | null {
  return lead.last_step_completed ? STEP_LABELS[lead.last_step_completed] ?? lead.last_step_completed : null;
}

export function isConvertedLead(lead: Pick<LeadRecord, 'status' | 'booking_id' | 'converted_at'>): boolean {
  return lead.status === 'converted' || !!lead.booking_id || !!lead.converted_at;
}

const isLost = (lead: Pick<LeadRecord, 'status' | 'lost_at'>) => lead.status === 'lost' || !!lead.lost_at;

/** "1 hour", "1 day", "1 week": the email's place in the sequence. */
function emailLabel(stepKey: string): string {
  return { '1_hour': '1-hour', '1_day': '1-day', '1_week': '1-week' }[stepKey] ?? stepKey.replace(/_/g, ' ');
}

const humanize = (text: string) => text.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Where the follow-up stands, and one line on what comes next. */
export function followUpState(
  lead: LeadRecord,
  enrollment: FollowUpEnrollment | null,
  steps: readonly FollowUpStep[],
): { meta: StatusMeta; detail: string } {
  if (isConvertedLead(lead)) return { meta: LEAD_FOLLOW_UP.converted, detail: 'Booked' };
  if (isLost(lead)) {
    return {
      meta: LEAD_FOLLOW_UP.lost,
      detail: enrollment?.lost_at ? `Lost ${formatFloridaDateTime(enrollment.lost_at)}` : 'The follow-up ran out without a booking',
    };
  }
  if (!enrollment) return { meta: LEAD_FOLLOW_UP.notStarted, detail: 'No follow-up sent yet' };
  if (enrollment.status === 'active') {
    const next = steps.find((s) => s.status === 'pending');
    const sent = steps.filter((s) => s.status === 'sent');
    const last = sent[sent.length - 1];
    return {
      meta: enrollment.webhook_triggered_at ? LEAD_FOLLOW_UP.active : LEAD_FOLLOW_UP.enrolled,
      detail: next
        ? `Next: ${emailLabel(next.step_key)} email, ${formatFloridaDateTime(next.scheduled_for)}`
        : last
          ? `Last sent: ${emailLabel(last.step_key)} email`
          : `Enrolled ${formatFloridaDateTime(enrollment.enrolled_at)}`,
    };
  }
  if (enrollment.status === 'cancelled') {
    return { meta: LEAD_FOLLOW_UP.stopped, detail: enrollment.stop_reason ? humanize(enrollment.stop_reason) : 'Follow-up stopped' };
  }
  if (enrollment.status === 'completed') return { meta: LEAD_FOLLOW_UP.completed, detail: 'Every email went out' };
  return { meta: { label: humanize(enrollment.status), tone: 'gray' }, detail: '' };
}

/** A follow-up can start on an open lead with none running (the API checks again). */
export function canStartFollowUp(lead: LeadRecord, enrollment: FollowUpEnrollment | null): boolean {
  return !isConvertedLead(lead) && !isLost(lead) && enrollment?.status !== 'active';
}

const relative = (iso: string, now: Date) => formatRelative(iso, { timeZone: FLORIDA_MTB_TIME_ZONE, now: now.getTime() });

function trailLabel(trail: TrailType | null, long = false): string | null {
  if (trail === 'mtb') return long ? 'Mountain bike' : 'MTB';
  if (trail === 'paved') return 'Paved';
  return null;
}

function progressOf(lead: LeadRecord) {
  return getBookingProgressMeta({
    trailType: lead.selected_trail_type,
    skillLevel: lead.selected_skill_level,
    lastStepCompleted: lead.last_step_completed,
    isCompleted: isConvertedLead(lead),
  });
}

// ─── The row of the list ────────────────────────────────────────────────────

export type LeadRow = {
  id: string;
  name: string;
  email: string;
  interest: string | null;
  source: string | null;
  stage: string | null;
  progress: number;
  followUp: StatusMeta;
  followUpDetail: string;
  lastActive: string;
  freshness: StatusMeta | null;
};

export function toLeadRow(lead: LeadRecord, enrollment: FollowUpEnrollment | null, steps: readonly FollowUpStep[], now: Date): LeadRow {
  const follow = followUpState(lead, enrollment, steps);
  return {
    id: lead.id,
    name: lead.full_name || lead.email,
    email: lead.email,
    interest: [trailLabel(lead.selected_trail_type), lead.selected_location_name].filter(Boolean).join(' · ') || null,
    source: lead.utm_source || lead.heard_about_us,
    stage: stageLabel(lead),
    progress: progressOf(lead).percent,
    followUp: follow.meta,
    followUpDetail: follow.detail,
    lastActive: relative(lead.last_activity_at, now),
    freshness: leadFreshness(lead.last_activity_at, now),
  };
}

// ─── The quick view of the drawer ───────────────────────────────────────────

export type FollowUpEmailView = { key: string; label: string; meta: StatusMeta; when: string | null };

export type LeadDetailView = {
  id: string;
  name: string;
  freshness: StatusMeta | null;
  contact: { email: string; phone: string | null; facts: Fact[] };
  intent: Fact[];
  attribution: Fact[];
  progress: { percent: number; label: string };
  followUp: { meta: StatusMeta; detail: string; facts: Fact[]; emails: FollowUpEmailView[] };
  /** Start the follow-up: only on an open lead with none running. */
  sendFollowUp: { to: string } | null;
};

const fact = (label: string, value: string | null | undefined): Fact | null => (value ? { label, value } : null);
const facts = (...list: (Fact | null)[]) => list.filter((f): f is Fact => f !== null);

function bikeLabel(bike: string | null): string | null {
  if (!bike) return null;
  if (bike === 'none') return 'Own bike';
  if (bike === 'electric') return 'E-bike';
  return 'Regular bike';
}

function emailView(step: FollowUpStep): FollowUpEmailView {
  const meta = FOLLOW_UP_STEP[step.status as keyof typeof FOLLOW_UP_STEP] ?? { label: humanize(step.status), tone: 'gray' as const };
  let when: string | null = null;
  if (step.status === 'sent' && step.sent_at) when = formatFloridaDateTime(step.sent_at);
  else if (step.status === 'pending') when = `Due ${formatFloridaDateTime(step.scheduled_for)}`;
  else if (step.skip_reason) when = humanize(step.skip_reason);
  return { key: step.id, label: `${humanize(emailLabel(step.step_key))} email`, meta, when };
}

export function toLeadDetail(lead: LeadRecord, enrollment: FollowUpEnrollment | null, steps: readonly FollowUpStep[], now: Date): LeadDetailView {
  const follow = followUpState(lead, enrollment, steps);
  const progress = progressOf(lead);
  return {
    id: lead.id,
    name: lead.full_name || lead.email,
    freshness: leadFreshness(lead.last_activity_at, now),
    contact: {
      email: lead.email,
      phone: lead.phone,
      facts: facts(fact('ZIP', lead.zip_code), fact('Heard about us', lead.heard_about_us)),
    },
    intent: facts(
      fact('Trail', trailLabel(lead.selected_trail_type, true)),
      fact('Skill', lead.selected_skill_level ? humanize(lead.selected_skill_level) : null),
      fact('Location', lead.selected_location_name),
      fact('Bike', bikeLabel(lead.selected_bike)),
      fact('Date', lead.selected_date ? formatFloridaCalendarDate(lead.selected_date) : null),
      fact('Time', lead.selected_time_slot ? formatTourTime(lead.selected_time_slot) : null),
      fact('Duration', lead.selected_duration_hours ? `${lead.selected_duration_hours}h` : null),
    ),
    attribution: facts(
      fact('UTM source', lead.utm_source),
      fact('UTM medium', lead.utm_medium),
      fact('UTM campaign', lead.utm_campaign),
      fact('UTM content', lead.utm_content),
      fact('UTM term', lead.utm_term),
    ),
    progress: {
      percent: progress.percent,
      label: progress.totalSteps
        ? `${progress.completedSteps} of ${progress.totalSteps} steps${stageLabel(lead) ? ` · last: ${stageLabel(lead)}` : ''}`
        : 'Not enough booking data to measure yet',
    },
    followUp: {
      meta: follow.meta,
      detail: follow.detail,
      facts: facts(
        fact('Enrolled', enrollment ? formatFloridaDateTime(enrollment.enrolled_at) : null),
        { label: 'Last active', value: `${relative(lead.last_activity_at, now)} · ${formatFloridaDateTime(lead.last_activity_at)}` },
        fact('First seen', formatFloridaDateTime(lead.created_at)),
      ),
      emails: enrollment ? steps.map(emailView) : [],
    },
    sendFollowUp: canStartFollowUp(lead, enrollment) ? { to: lead.email } : null,
  };
}
