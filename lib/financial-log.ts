import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type FinancialEventMetadata = Record<string, JsonValue>;

export type FinancialEventInput = {
  event_name: string;
  event_category?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  entity_type: string;
  entity_id: string;
  booking_id?: string | null;
  lead_id?: string | null;
  stripe_session_id?: string | null;
  payment_intent_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  requires_attention?: boolean;
  message?: string | null;
  metadata?: FinancialEventMetadata;
  occurred_at?: string;
};

function trimMessage(message: string | null | undefined) {
  if (!message) return null;
  return message.replace(/\s+/g, ' ').trim().slice(0, 400);
}

export async function recordFinancialEvent(input: FinancialEventInput) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('financial_event_logs')
    .insert({
      event_name: input.event_name,
      event_category: input.event_category ?? 'payment',
      severity: input.severity ?? 'info',
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      booking_id: input.booking_id ?? null,
      lead_id: input.lead_id ?? null,
      stripe_session_id: input.stripe_session_id ?? null,
      payment_intent_id: input.payment_intent_id ?? null,
      amount: input.amount ?? null,
      currency: input.currency ?? null,
      status: input.status ?? null,
      requires_attention: input.requires_attention ?? false,
      message: trimMessage(input.message),
      metadata: input.metadata ?? {},
      occurred_at: input.occurred_at ?? new Date().toISOString(),
    });

  if (error) {
    console.error('[financial-log] Failed to record financial event:', {
      event_name: input.event_name,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      error,
    });
  }
}
