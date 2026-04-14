import { getSupabaseAdmin } from '@/lib/supabase';
import { notifyDustinLeadAlert } from '@/lib/lead-alerts';

export type LeadBookingSessionStatus =
  | 'active'
  | 'checkout_started'
  | 'converted'
  | 'abandoned';

interface LeadRowForAlert {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  selected_trail_type: string | null;
  selected_location_name: string | null;
  selected_date: string | null;
  last_step_completed: string | null;
  created_at: string | null;
  status: string | null;
}

interface LeadSessionRow {
  id: string;
  lead_id: string;
  status: LeadBookingSessionStatus;
  abandoned_alert_sent_at: string | null;
}

type AbandonReason = 'page_exit' | 'inactivity_timeout' | 'checkout_expired';

export async function createLeadBookingSession(leadId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lead_booking_sessions')
    .insert({
      lead_id: leadId,
      status: 'active',
      started_at: now,
      last_activity_at: now,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`[lead-session] Failed to create session for lead ${leadId}:`, error.message);
    return null;
  }

  return (data as { id: string }).id;
}

export async function ensureActiveLeadBookingSession(
  leadId: string,
  currentSessionId?: string | null
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (currentSessionId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('lead_booking_sessions')
      .select('id, status')
      .eq('id', currentSessionId)
      .eq('lead_id', leadId)
      .single();

    const session = existing as { id: string; status: LeadBookingSessionStatus } | null;

    if (session?.status === 'active') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('lead_booking_sessions')
        .update({
          last_activity_at: now,
          updated_at: now,
        })
        .eq('id', currentSessionId)
        .eq('lead_id', leadId)
        .eq('status', 'active');

      return currentSessionId;
    }
  }

  return createLeadBookingSession(leadId);
}

export async function touchLeadBookingSession(
  leadId: string,
  sessionId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('lead_booking_sessions')
    .update({
      last_activity_at: now,
      updated_at: now,
    })
    .eq('id', sessionId)
    .eq('lead_id', leadId)
    .eq('status', 'active');

  if (error) {
    console.error(`[lead-session] Failed to touch session ${sessionId}:`, error.message);
  }
}

export async function markLeadSessionCheckoutStarted(
  leadId: string,
  sessionId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('lead_booking_sessions')
    .update({
      status: 'checkout_started',
      checkout_started_at: now,
      last_activity_at: now,
      updated_at: now,
    })
    .eq('id', sessionId)
    .eq('lead_id', leadId)
    .eq('status', 'active');

  if (error) {
    console.error(`[lead-session] Failed to mark checkout_started for session ${sessionId}:`, error.message);
  }
}

export async function markLeadSessionConverted(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('lead_booking_sessions')
    .update({
      status: 'converted',
      converted_at: now,
      updated_at: now,
    })
    .eq('id', sessionId)
    .in('status', ['active', 'checkout_started']);

  if (error) {
    console.error(`[lead-session] Failed to mark session ${sessionId} converted:`, error.message);
  }
}

async function hasSuccessfulBookingForLead(leadId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bookings')
    .select('id')
    .eq('lead_id', leadId)
    .in('status', ['confirmed', 'completed'])
    .limit(1);

  if (error) {
    console.error(`[lead-session] Failed to verify booking state for lead ${leadId}:`, error.message);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

export async function confirmLeadSessionAbandoned(input: {
  leadId: string;
  sessionId: string;
  reason: AbandonReason;
  allowedStatuses: LeadBookingSessionStatus[];
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessionData, error: sessionFetchError } = await (supabase as any)
    .from('lead_booking_sessions')
    .select('id, lead_id, status, abandoned_alert_sent_at')
    .eq('id', input.sessionId)
    .eq('lead_id', input.leadId)
    .single();

  if (sessionFetchError) {
    console.error(`[lead-session] Failed to fetch session ${input.sessionId}:`, sessionFetchError.message);
    return false;
  }

  const session = sessionData as LeadSessionRow | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leadData, error: leadFetchError } = await (supabase as any)
    .from('leads')
    .select(`
      id,
      full_name,
      email,
      phone,
      selected_trail_type,
      selected_location_name,
      selected_date,
      last_step_completed,
      created_at,
      status
    `)
    .eq('id', input.leadId)
    .single();

  if (leadFetchError) {
    console.error(`[lead-session] Failed to fetch lead ${input.leadId}:`, leadFetchError.message);
    return false;
  }

  const lead = leadData as LeadRowForAlert | null;
  if (!lead || lead.status === 'converted') {
    return false;
  }

  if (await hasSuccessfulBookingForLead(input.leadId)) {
    return false;
  }

  if (session?.status === 'abandoned') {
    if (session.abandoned_alert_sent_at) {
      return false;
    }

    const notified = await notifyDustinLeadAlert({
      lead_id: lead.id,
      full_name: lead.full_name,
      email: lead.email,
      phone: lead.phone,
      tour_type: lead.selected_trail_type,
      location: lead.selected_location_name,
      preferred_date: lead.selected_date,
      booking_step_last_seen: lead.last_step_completed,
      created_at: lead.created_at,
    });

    if (notified) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('lead_booking_sessions')
        .update({
          abandoned_alert_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.sessionId)
        .is('abandoned_alert_sent_at', null);
    }

    return notified;
  }

  if (!session || !input.allowedStatuses.includes(session.status)) {
    return false;
  }

  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedSession, error: sessionUpdateError } = await (supabase as any)
    .from('lead_booking_sessions')
    .update({
      status: 'abandoned',
      exited_at: now,
      abandonment_confirmed_at: now,
      last_activity_at: now,
      updated_at: now,
    })
    .eq('id', input.sessionId)
    .eq('lead_id', input.leadId)
    .in('status', input.allowedStatuses)
    .is('abandonment_confirmed_at', null)
    .select('id')
    .single();

  if (sessionUpdateError || !updatedSession) {
    if (sessionUpdateError) {
      console.error(`[lead-session] Failed to confirm abandonment for session ${input.sessionId}:`, sessionUpdateError.message);
    }
    return false;
  }

  const notified = await notifyDustinLeadAlert({
    lead_id: lead.id,
    full_name: lead.full_name,
    email: lead.email,
    phone: lead.phone,
    tour_type: lead.selected_trail_type,
    location: lead.selected_location_name,
    preferred_date: lead.selected_date,
    booking_step_last_seen: lead.last_step_completed,
    created_at: lead.created_at,
  });

  if (notified) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('lead_booking_sessions')
      .update({
        abandoned_alert_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.sessionId)
      .is('abandoned_alert_sent_at', null);
  }

  console.log(`[lead-session] Session ${input.sessionId} marked abandoned via ${input.reason}.`);
  return true;
}
