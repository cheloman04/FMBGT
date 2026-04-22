import 'server-only';

export type N8nWebhookResult = {
  ok: boolean;
  attemptedAt: string;
  statusCode: number | null;
  error: string | null;
};

type TriggerN8nEventInput = {
  event: string;
  data: Record<string, unknown>;
  source?: string;
  webhookUrl?: string | null;
  envKeys?: string[];
};

export type SupportAlertInput = {
  source: string;
  summary: string;
  severity?: 'warning' | 'error' | 'critical';
  bookingId?: string | null;
  leadId?: string | null;
  stripeSessionId?: string | null;
  paymentIntentId?: string | null;
  details?: Record<string, unknown>;
};

function trimN8nError(message: string) {
  return message.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function resolveWebhookUrl(input?: { webhookUrl?: string | null; envKeys?: string[] }) {
  if (input?.webhookUrl) return input.webhookUrl;

  const keys = input?.envKeys ?? ['N8N_WEBHOOK_URL'];
  for (const key of keys) {
    const value = process.env[key];
    if (value && value !== 'your_n8n_webhook_url_here') {
      return value;
    }
  }

  return null;
}

export async function triggerN8nEvent(
  input: TriggerN8nEventInput
): Promise<N8nWebhookResult> {
  const attemptedAt = new Date().toISOString();
  const webhookUrl = resolveWebhookUrl({
    webhookUrl: input.webhookUrl,
    envKeys: input.envKeys,
  });

  if (!webhookUrl) {
    return {
      ok: false,
      attemptedAt,
      statusCode: null,
      error: 'n8n webhook URL not configured',
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        event: input.event,
        source: input.source ?? 'app',
        data: input.data,
        timestamp: attemptedAt,
      }),
    });

    if (!response.ok) {
      const responseText = trimN8nError(await response.text());
      const errorMessage = responseText
        ? `n8n returned ${response.status}: ${responseText}`
        : `n8n returned ${response.status}`;

      return {
        ok: false,
        attemptedAt,
        statusCode: response.status,
        error: errorMessage,
      };
    }

    return {
      ok: true,
      attemptedAt,
      statusCode: response.status,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      attemptedAt,
      statusCode: null,
      error: trimN8nError(error instanceof Error ? error.message : 'Unknown network error'),
    };
  }
}

export async function notifySupportAlert(
  input: SupportAlertInput
): Promise<N8nWebhookResult> {
  return triggerN8nEvent({
    event: 'ops_alert',
    source: input.source,
    envKeys: ['N8N_SUPPORT_WEBHOOK_URL', 'N8N_WEBHOOK_URL'],
    data: {
      severity: input.severity ?? 'error',
      summary: input.summary,
      booking_id: input.bookingId ?? null,
      lead_id: input.leadId ?? null,
      stripe_session_id: input.stripeSessionId ?? null,
      payment_intent_id: input.paymentIntentId ?? null,
      details: input.details ?? {},
    },
  });
}
