import 'server-only';

const REQUEST_TIMEOUT_MS = 8_000;

export type MetaEventPayload = Record<string, unknown>;
export type MetaUserDataInput = {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  externalId?: string | null;
};

export type MetaSendResult = {
  ok: boolean;
  eventName: string;
  eventId: string;
  statusCode: number | null;
  responseBody: string | null;
  error: string | null;
};

function getMetaConfig() {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  const apiVersion = process.env.META_API_VERSION?.trim();
  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim() || null;

  return {
    pixelId: pixelId || null,
    accessToken: accessToken || null,
    apiVersion: apiVersion || null,
    testEventCode,
  };
}

function getFirstEvent(payload: MetaEventPayload): Record<string, unknown> | null {
  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    return null;
  }

  const first = payload.data[0];
  return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
}

function getEventIdentity(payload: MetaEventPayload) {
  const firstEvent = getFirstEvent(payload);
  const eventName =
    firstEvent && typeof firstEvent.event_name === 'string'
      ? firstEvent.event_name
      : 'unknown';
  const eventId =
    firstEvent && typeof firstEvent.event_id === 'string'
      ? firstEvent.event_id
      : 'unknown';

  return { eventName, eventId, firstEvent };
}

function sanitizePayloadForLogs(payload: MetaEventPayload) {
  const firstEvent = getFirstEvent(payload);
  const userData =
    firstEvent && firstEvent.user_data && typeof firstEvent.user_data === 'object'
      ? (firstEvent.user_data as Record<string, unknown>)
      : null;
  const customData =
    firstEvent && firstEvent.custom_data && typeof firstEvent.custom_data === 'object'
      ? (firstEvent.custom_data as Record<string, unknown>)
      : null;

  return {
    test_event_code_present: typeof payload.test_event_code === 'string',
    data_count: Array.isArray(payload.data) ? payload.data.length : 0,
    event: firstEvent
      ? {
          event_name:
            typeof firstEvent.event_name === 'string' ? firstEvent.event_name : 'unknown',
          event_time:
            typeof firstEvent.event_time === 'number' ? firstEvent.event_time : null,
          event_id:
            typeof firstEvent.event_id === 'string' ? firstEvent.event_id : 'unknown',
          action_source:
            typeof firstEvent.action_source === 'string' ? firstEvent.action_source : null,
          event_source_url:
            typeof firstEvent.event_source_url === 'string'
              ? firstEvent.event_source_url
              : null,
          user_data_keys: userData ? Object.keys(userData) : [],
          custom_data: customData ?? null,
        }
      : null,
  };
}

function normalizeEmail(email?: string | null) {
  const value = email?.trim().toLowerCase();
  return value || null;
}

function normalizePhone(phone?: string | null) {
  const digits = phone?.replace(/\D+/g, '') ?? '';
  return digits || null;
}

function splitFullName(fullName?: string | null) {
  const value = fullName?.trim();
  if (!value) {
    return { firstName: null, lastName: null };
  }

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  }

  return {
    firstName: parts[0]?.toLowerCase() ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ').toLowerCase() : null,
  };
}

export function getClientIpFromHeaders(headers: Headers): string | null {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headers.get('x-real-ip')?.trim();

  return forwardedFor || realIp || null;
}

export function getEventSourceUrlFromHeaders(headers: Headers): string | null {
  const referer = headers.get('referer')?.trim();
  const origin = headers.get('origin')?.trim();

  return referer || origin || null;
}

export function buildMetaUserData(input: MetaUserDataInput): Record<string, string> {
  const { firstName, lastName } = splitFullName(input.fullName);

  const userData: Record<string, string> = {};
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const clientIpAddress = input.clientIpAddress?.trim();
  const clientUserAgent = input.clientUserAgent?.trim();
  const fbc = input.fbc?.trim();
  const fbp = input.fbp?.trim();
  const externalId = input.externalId?.trim();

  if (email) userData.em = email;
  if (phone) userData.ph = phone;
  if (firstName) userData.fn = firstName;
  if (lastName) userData.ln = lastName;
  if (clientIpAddress) userData.client_ip_address = clientIpAddress;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;
  if (externalId) userData.external_id = externalId;

  return userData;
}

export async function sendMetaEvent(payload: MetaEventPayload): Promise<MetaSendResult> {
  const { eventName, eventId } = getEventIdentity(payload);
  const config = getMetaConfig();

  console.log(`[meta-capi] attempting ${eventName}`, {
    event_id: eventId,
    has_pixel_id: Boolean(config.pixelId),
    has_access_token: Boolean(config.accessToken),
    api_version: config.apiVersion,
    has_test_event_code: Boolean(config.testEventCode),
  });

  if (!config.pixelId || !config.accessToken || !config.apiVersion) {
    const error = 'Missing META_PIXEL_ID, META_ACCESS_TOKEN, or META_API_VERSION';
    console.error(`[meta-capi] failed ${eventName}`, {
      event_id: eventId,
      status_code: null,
      response_body: null,
      error,
    });

    return {
      ok: false,
      eventName,
      eventId,
      statusCode: null,
      responseBody: null,
      error,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.pixelId}/events?access_token=${config.accessToken}`;
    const requestPayload = config.testEventCode
      ? { ...payload, test_event_code: config.testEventCode }
      : payload;

    console.log(`[meta-capi] payload ${eventName}`, {
      event_id: eventId,
      payload: sanitizePayloadForLogs(requestPayload),
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
      cache: 'no-store',
    });

    const responseBody = await response.text().catch(() => '');

    if (!response.ok) {
      console.error(
        `[meta-capi] failed ${eventName} ${response.status} ${responseBody || '(empty body)'}`,
        {
          event_id: eventId,
          status_code: response.status,
          response_body: responseBody || null,
        }
      );

      return {
        ok: false,
        eventName,
        eventId,
        statusCode: response.status,
        responseBody: responseBody || null,
        error: `Meta returned ${response.status}`,
      };
    }

    console.log(`[meta-capi] success ${eventName}`, {
      event_id: eventId,
      status_code: response.status,
      response_body: responseBody || null,
    });

    return {
      ok: true,
      eventName,
      eventId,
      statusCode: response.status,
      responseBody: responseBody || null,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Meta network error';
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[meta-capi] timeout ${eventName}`, {
        event_id: eventId,
        error: message,
      });

      return {
        ok: false,
        eventName,
        eventId,
        statusCode: null,
        responseBody: null,
        error: message,
      };
    }

    console.error(`[meta-capi] exception ${eventName} ${message}`, {
      event_id: eventId,
      error: message,
    });

    return {
      ok: false,
      eventName,
      eventId,
      statusCode: null,
      responseBody: null,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
