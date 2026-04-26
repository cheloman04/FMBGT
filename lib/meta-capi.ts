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

function logDevError(message: string, error?: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.error(message, error);
}

function getMetaConfig() {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  const apiVersion = process.env.META_API_VERSION?.trim();
  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim() || null;

  if (!pixelId || !accessToken || !apiVersion) {
    return null;
  }

  return { pixelId, accessToken, apiVersion, testEventCode };
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

export async function sendMetaEvent(payload: MetaEventPayload): Promise<void> {
  const config = getMetaConfig();

  if (!config) {
    logDevError('[meta-capi] Missing META_* configuration.');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.pixelId}/events?access_token=${config.accessToken}`;
    const requestPayload = config.testEventCode
      ? { ...payload, test_event_code: config.testEventCode }
      : payload;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      logDevError(`[meta-capi] Request failed with status ${response.status}.`, responseText);
    }
  } catch (error) {
    logDevError('[meta-capi] Failed to send event.', error);
  } finally {
    clearTimeout(timeout);
  }
}
