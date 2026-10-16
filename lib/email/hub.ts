// POST /api/channels/email — handing one composed email to the Kigaru hub
// (contract §5.1), and what each answer means for the outbox.
//
// The rule (contract §0 and §5.1): retry ONLY 429, 5xx and network errors, with the
// SAME idempotency key — that includes `503 paused` (the studio's sending is on
// hold). Any other 4xx is final: a 422 won't change by retrying (suppressed,
// not configured, or a body we built wrong), a 409 means we reused a key for
// another recipient (our bug), and 401/403 is the connection or its scope.
//
// No imports on purpose (only types): the tests load this as is, with a fake fetch.

export type HubConnection = { baseUrl: string; key: string; secret: string };

export type HubEmailBody = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  email_type: string;
  category: 'transactional' | 'marketing';
  idempotency_key: string;
  entity_type?: string;
  entity_id?: string;
  reply_to?: string;
};

export type HubSendOutcome =
  /** 202 queued, or 200 duplicate: the hub has it. Never send it again. */
  | { kind: 'accepted'; httpStatus: number; hubEmailId: string | null; hubStatus: string | null; duplicate: boolean }
  /** A final no. `reason` is the hub's (`suppressed`, `not_configured`, `idempotency_conflict`…). */
  | { kind: 'rejected'; httpStatus: number; reason: string; error: string }
  /** Try again later with the same key. `httpStatus` is null for a network error or timeout. */
  | { kind: 'retry'; httpStatus: number | null; error: string };

const TIMEOUT_MS = 10_000;

function trim(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

export async function postEmailToHub(
  connection: HubConnection,
  body: HubEmailBody,
  fetchImpl: typeof fetch = fetch,
): Promise<HubSendOutcome> {
  let res: Response;
  try {
    res = await fetchImpl(`${connection.baseUrl}/api/channels/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-senzai-connection-key': connection.key,
        'x-senzai-connection-secret': connection.secret,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    // Never log the request: it carries the secret in its headers.
    return { kind: 'retry', httpStatus: null, error: `network: ${error instanceof Error ? error.name : 'error'}` };
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const message = trim(json?.error) || `hub ${res.status}`;

  if (res.status === 200 || res.status === 202) {
    return {
      kind: 'accepted',
      httpStatus: res.status,
      hubEmailId: typeof json?.id === 'string' ? json.id : null,
      hubStatus: typeof json?.status === 'string' ? json.status : null,
      duplicate: json?.duplicate === true,
    };
  }
  if (res.status === 429 || res.status >= 500) {
    const reason = typeof json?.reason === 'string' ? ` (${json.reason})` : '';
    return { kind: 'retry', httpStatus: res.status, error: `${message}${reason}` };
  }
  const reason =
    typeof json?.reason === 'string'
      ? json.reason
      : typeof json?.code === 'string'
        ? json.code
        : res.status === 422
          ? 'invalid'
          : `http_${res.status}`;
  const details = json?.details ? ` ${trim(JSON.stringify(json.details))}` : '';
  return { kind: 'rejected', httpStatus: res.status, reason, error: `${message}${details}`.slice(0, 500) };
}
