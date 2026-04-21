import 'server-only';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type SenzaiAttributes = Record<string, JsonValue>;

export type SenzaiEntityRefs = {
  booking_id?: string | null;
  lead_id?: string | null;
  customer_id?: string | null;
  waiver_session_id?: string | null;
  review_enrollment_id?: string | null;
  stripe_event_id?: string | null;
  stripe_session_id?: string | null;
  payment_intent_id?: string | null;
};

export type SenzaiEventInput = {
  event_name: string;
  occurred_at: string;
  source_event_id: string;
  idempotency_key: string;
  source_route: string;
  authoritative_source: string;
  entity_type: string;
  entity_id: string;
  refs?: SenzaiEntityRefs;
  data?: SenzaiAttributes;
};

type SenzaiIngestEvent = {
  event_name: string;
  occurred_at: string;
  source_event_id: string;
  idempotency_key: string;
  attributes: SenzaiAttributes;
};

export type SenzaiIngestResult = {
  ok: boolean;
  skipped: boolean;
  statusCode: number | null;
  error: string | null;
  ingestUrl: string | null;
};

const SENZAI_INGEST_PATH = '/api/ingest/events';
const SCHEMA_VERSION = '2026-04-21';

function trimErrorMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function hasRequiredConfig() {
  return Boolean(
    process.env.SENZAI_INGEST_URL &&
      process.env.SENZAI_CONNECTION_KEY &&
      process.env.SENZAI_CONNECTION_SECRET
  );
}

function resolveIngestUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  return normalizedBaseUrl.endsWith(SENZAI_INGEST_PATH)
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}${SENZAI_INGEST_PATH}`;
}

function normalizeRefs(refs?: SenzaiEntityRefs): SenzaiAttributes {
  return {
    booking_id: refs?.booking_id ?? null,
    lead_id: refs?.lead_id ?? null,
    customer_id: refs?.customer_id ?? null,
    waiver_session_id: refs?.waiver_session_id ?? null,
    review_enrollment_id: refs?.review_enrollment_id ?? null,
    stripe_event_id: refs?.stripe_event_id ?? null,
    stripe_session_id: refs?.stripe_session_id ?? null,
    payment_intent_id: refs?.payment_intent_id ?? null,
  };
}

function buildEventPayload(input: SenzaiEventInput): SenzaiIngestEvent {
  return {
    event_name: input.event_name,
    occurred_at: input.occurred_at,
    source_event_id: input.source_event_id,
    idempotency_key: input.idempotency_key,
    attributes: {
      schema_version: SCHEMA_VERSION,
      source_system: 'florida_mountain_bike_guides',
      source_environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      source_route: input.source_route,
      authoritative_source: input.authoritative_source,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      refs: normalizeRefs(input.refs),
      data: input.data ?? {},
    },
  };
}

function logEvent(
  level: 'info' | 'warn' | 'error',
  phase: string,
  input: SenzaiEventInput,
  extra?: Record<string, JsonValue>
) {
  const logger = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error;
  logger('[senzai-ingest]', {
    phase,
    event_name: input.event_name,
    source_event_id: input.source_event_id,
    idempotency_key: input.idempotency_key,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    source_route: input.source_route,
    authoritative_source: input.authoritative_source,
    ...extra,
  });
}

export function getSenzaiIngestUrl(): string | null {
  const baseUrl = process.env.SENZAI_INGEST_URL;
  return baseUrl ? resolveIngestUrl(baseUrl) : null;
}

export async function sendSenzaiEvent(
  input: SenzaiEventInput
): Promise<SenzaiIngestResult> {
  if (!hasRequiredConfig()) {
    logEvent('warn', 'skipped_missing_config', input, {
      ingest_url: process.env.SENZAI_INGEST_URL ?? null,
    });
    return {
      ok: false,
      skipped: true,
      statusCode: null,
      error: 'Senzai ingest is not configured',
      ingestUrl: getSenzaiIngestUrl(),
    };
  }

  const ingestUrl = getSenzaiIngestUrl() as string;
  const connectionKey = process.env.SENZAI_CONNECTION_KEY as string;
  const connectionSecret = process.env.SENZAI_CONNECTION_SECRET as string;
  const authToken = Buffer.from(`${connectionKey}:${connectionSecret}`).toString('base64');
  const payload = buildEventPayload(input);

  logEvent('info', 'sending', input, { ingest_url: ingestUrl });

  try {
    const response = await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authToken}`,
        'X-Senzai-Connection-Key': connectionKey,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = trimErrorMessage(await response.text());
      const errorMessage = responseText
        ? `Senzai returned ${response.status}: ${responseText}`
        : `Senzai returned ${response.status}`;

      if (response.status === 404) {
        logEvent('warn', 'endpoint_not_found', input, {
          ingest_url: ingestUrl,
          note: 'Base URL may be live while the ingest route is not yet deployed',
        });
      }

      logEvent('error', 'failed', input, {
        ingest_url: ingestUrl,
        status_code: response.status,
        error: errorMessage,
      });
      return {
        ok: false,
        skipped: false,
        statusCode: response.status,
        error: errorMessage,
        ingestUrl,
      };
    }

    logEvent('info', 'sent', input, {
      ingest_url: ingestUrl,
      status_code: response.status,
    });
    return {
      ok: true,
      skipped: false,
      statusCode: response.status,
      error: null,
      ingestUrl,
    };
  } catch (error) {
    const message = trimErrorMessage(
      error instanceof Error ? error.message : 'Unknown Senzai ingest error'
    );
    logEvent('error', 'network_failure', input, {
      ingest_url: ingestUrl,
      error: message,
    });
    return {
      ok: false,
      skipped: false,
      statusCode: null,
      error: message,
      ingestUrl,
    };
  }
}
