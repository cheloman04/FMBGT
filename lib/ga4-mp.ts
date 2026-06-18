import 'server-only';

/**
 * GA4 Measurement Protocol emitter — the server-side conversion path for GA4.
 *
 * Mirrors lib/meta-capi.ts (sendMetaEvent): a cookie-less server channel that fires
 * money conversions to GA4 from the Stripe webhook (the authoritative paid state),
 * backstopping the browser-only gtag `purchase`. It replays the real `_ga` client_id
 * + `_ga_<stream>` session_id captured on the booking's attribution snapshot so the
 * conversion attributes to the originating session/campaign instead of (direct).
 *
 * Config (mirrors the meta-capi env pattern):
 *   - NEXT_PUBLIC_GA_MEASUREMENT_ID — the GA4 measurement id (already wired in layout)
 *   - GA4_API_SECRET                — Measurement Protocol API secret (GA4 Admin →
 *                                     Data Streams → Measurement Protocol API secrets)
 * If either is missing the emit is skipped gracefully (no throw) — exactly like the
 * Meta/Senzai emitters degrade when unconfigured.
 */

const REQUEST_TIMEOUT_MS = 8_000;
const GA4_MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

export type Ga4EventParams = Record<string, unknown>;

export type Ga4EventInput = {
  /** Real GA4 client_id (`<clientId>.<firstVisitTs>`) — see syntheticGaClientId for the fallback. */
  clientId: string;
  /** GA4 session_id from `_ga_<stream>` — what actually stitches the event to the session. */
  sessionId?: string | null;
  /** GA4 event name, e.g. `purchase`. */
  name: string;
  params?: Ga4EventParams;
};

export type Ga4SendResult = {
  ok: boolean;
  skipped: boolean;
  eventName: string;
  clientId: string;
  statusCode: number | null;
  error: string | null;
};

function getGa4Config() {
  const measurementId = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-SMP4GWTYJW').trim();
  const apiSecret = process.env.GA4_API_SECRET?.trim() || null;
  return { measurementId: measurementId || null, apiSecret };
}

/**
 * Deterministic, cookie-less fallback client_id (`<int>.<int>`). LAST RESORT only:
 * it lets GA4 still COUNT the conversion when no `_ga` was ever captured (e.g. the
 * user blocked GA, so there is also no browser purchase), at the cost of attributing
 * it to (direct). Derived from the booking id (FNV-1a, no time/random) so webhook
 * retries and replays produce the same id and GA4 dedups them.
 */
export function syntheticGaClientId(seed: string): string {
  const fnv = (input: string): number => {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  return `${fnv(seed)}.${fnv(`${seed}:ga`)}`;
}

export async function sendGa4Event(input: Ga4EventInput): Promise<Ga4SendResult> {
  const { name, clientId } = input;
  const config = getGa4Config();

  console.log(`[ga4-mp] attempting ${name}`, {
    client_id_present: Boolean(clientId),
    session_id_present: Boolean(input.sessionId),
    has_measurement_id: Boolean(config.measurementId),
    has_api_secret: Boolean(config.apiSecret),
  });

  if (!config.measurementId || !config.apiSecret) {
    const error = 'Missing NEXT_PUBLIC_GA_MEASUREMENT_ID or GA4_API_SECRET';
    console.warn(`[ga4-mp] skipped ${name}`, { error });
    return { ok: false, skipped: true, eventName: name, clientId, statusCode: null, error };
  }

  if (!clientId) {
    const error = 'Missing GA4 client_id';
    console.warn(`[ga4-mp] skipped ${name}`, { error });
    return { ok: false, skipped: true, eventName: name, clientId, statusCode: null, error };
  }

  // GA4 needs session_id + engagement_time_msec for the event to attach to a session
  // and surface in standard reports (Realtime/Acquisition).
  const params: Ga4EventParams = {
    engagement_time_msec: 1,
    ...(input.sessionId ? { session_id: input.sessionId } : {}),
    ...(input.params ?? {}),
  };

  const body = {
    client_id: clientId,
    events: [{ name, params }],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${GA4_MP_ENDPOINT}?measurement_id=${encodeURIComponent(
      config.measurementId
    )}&api_secret=${encodeURIComponent(config.apiSecret)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });

    // The production /mp/collect endpoint returns 204 No Content on success and does
    // not validate the payload — use /debug/mp/collect (scripts/ga4-mp-debug.mjs) to
    // validate shape. Any non-2xx here is a transport/auth problem.
    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      console.error(`[ga4-mp] failed ${name} ${response.status} ${responseBody || '(empty body)'}`, {
        client_id: clientId,
        status_code: response.status,
      });
      return {
        ok: false,
        skipped: false,
        eventName: name,
        clientId,
        statusCode: response.status,
        error: `GA4 returned ${response.status}`,
      };
    }

    console.log(`[ga4-mp] success ${name}`, {
      client_id: clientId,
      status_code: response.status,
    });
    return {
      ok: true,
      skipped: false,
      eventName: name,
      clientId,
      statusCode: response.status,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown GA4 network error';
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[ga4-mp] timeout ${name}`, { client_id: clientId, error: message });
    } else {
      console.error(`[ga4-mp] exception ${name} ${message}`, { client_id: clientId });
    }
    return {
      ok: false,
      skipped: false,
      eventName: name,
      clientId,
      statusCode: null,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
