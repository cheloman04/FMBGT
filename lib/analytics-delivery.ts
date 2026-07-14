import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase';
import { sendGa4Event, type Ga4EventInput } from '@/lib/ga4-mp';
import { sendMetaEvent, type MetaEventPayload } from '@/lib/meta-capi';
import { sendSenzaiEvent, type SenzaiEventInput } from '@/lib/senzai-ingest';

export type AnalyticsDestination = 'ga4' | 'meta' | 'senzai';

type DeliveryPayload =
  | { destination: 'ga4'; input: Ga4EventInput }
  | { destination: 'meta'; input: MetaEventPayload }
  | { destination: 'senzai'; input: SenzaiEventInput };

export type AnalyticsDeliveryRow = {
  id: string;
  delivery_key: string;
  destination: AnalyticsDestination;
  event_name: string;
  source_event_id: string;
  payload: DeliveryPayload;
  attempt_count: number;
};

export type QueueDeliveryInput = {
  deliveryKey: string;
  eventName: string;
  sourceEventId: string;
  payload: DeliveryPayload;
};

export function retryDelayMs(attemptCount: number): number {
  const exponent = Math.max(0, Math.min(attemptCount - 1, 30));
  return Math.min(60_000 * 2 ** exponent, 6 * 60 * 60 * 1000);
}

function trimError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, 500);
}

async function deliver(row: AnalyticsDeliveryRow): Promise<{ ok: boolean; error: string | null }> {
  switch (row.payload.destination) {
    case 'senzai': {
      const result = await sendSenzaiEvent(row.payload.input);
      return { ok: result.ok && result.hubStatus === 'translated', error: result.error };
    }
    case 'ga4': {
      const result = await sendGa4Event(row.payload.input);
      return { ok: result.ok, error: result.error };
    }
    case 'meta': {
      const result = await sendMetaEvent(row.payload.input);
      return { ok: result.ok, error: result.error };
    }
  }
}

export async function processAnalyticsDeliveries(options?: {
  limit?: number;
  deliveryKeys?: string[];
}): Promise<{ claimed: number; delivered: number; failed: number }> {
  // Database typing intentionally lags proposed migrations in this repository.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseAdmin() as any;
  const { data, error } = await db.rpc('claim_analytics_deliveries', {
    p_limit: options?.limit ?? 25,
    p_delivery_keys: options?.deliveryKeys?.length ? options.deliveryKeys : null,
  });

  if (error) throw new Error(`Failed to claim analytics deliveries: ${error.message}`);

  const rows = (data ?? []) as AnalyticsDeliveryRow[];
  const summary = { claimed: rows.length, delivered: 0, failed: 0 };

  for (const row of rows) {
    try {
      const result = await deliver(row);
      if (result.ok) {
        const { error: updateError } = await db
          .from('analytics_delivery_outbox')
          .update({
            status: 'delivered',
            delivered_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
          .eq('status', 'processing');
        if (updateError) throw updateError;
        summary.delivered++;
        continue;
      }
      throw new Error(result.error ?? `${row.destination} did not acknowledge delivery`);
    } catch (deliveryError) {
      const nextAttemptAt = new Date(Date.now() + retryDelayMs(row.attempt_count)).toISOString();
      const { error: updateError } = await db
        .from('analytics_delivery_outbox')
        .update({
          status: 'failed',
          next_attempt_at: nextAttemptAt,
          last_error: trimError(deliveryError),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('status', 'processing');
      if (updateError) {
        console.error('[analytics-delivery] failed to persist retry state', {
          delivery_key: row.delivery_key,
          error: updateError.message,
        });
      }
      summary.failed++;
    }
  }

  return summary;
}

export async function queueAnalyticsDelivery(input: QueueDeliveryInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseAdmin() as any;
  const { error } = await db.from('analytics_delivery_outbox').insert({
    delivery_key: input.deliveryKey,
    destination: input.payload.destination,
    event_name: input.eventName,
    source_event_id: input.sourceEventId,
    payload: input.payload,
  });

  if (error && error.code !== '23505') {
    throw new Error(`Failed to persist analytics delivery: ${error.message}`);
  }

  await processAnalyticsDeliveries({ deliveryKeys: [input.deliveryKey], limit: 1 });
}

export async function queueSenzaiEvent(input: SenzaiEventInput): Promise<void> {
  return queueAnalyticsDelivery({
    deliveryKey: `senzai:${input.idempotency_key}`,
    eventName: input.event_name,
    sourceEventId: input.source_event_id,
    payload: { destination: 'senzai', input },
  });
}

export async function queueGa4Event(
  deliveryKey: string,
  sourceEventId: string,
  input: Ga4EventInput
): Promise<void> {
  return queueAnalyticsDelivery({
    deliveryKey: `ga4:${deliveryKey}`,
    eventName: input.name,
    sourceEventId,
    payload: { destination: 'ga4', input },
  });
}

export async function queueMetaEvent(
  deliveryKey: string,
  sourceEventId: string,
  input: MetaEventPayload
): Promise<void> {
  const firstEvent = Array.isArray(input.data) ? input.data[0] : null;
  const eventName =
    firstEvent && typeof firstEvent === 'object' && typeof firstEvent.event_name === 'string'
      ? firstEvent.event_name
      : 'unknown';
  return queueAnalyticsDelivery({
    deliveryKey: `meta:${deliveryKey}`,
    eventName,
    sourceEventId,
    payload: { destination: 'meta', input },
  });
}
