import { getBookingLocationMeta } from '@/lib/location-meta';

const DEFAULT_DUSTIN_LEAD_ALERT_WEBHOOK_URL =
  'https://fmbgt-n8n.yvjziu.easypanel.host/webhook/notify-dustin-lead-alert';
const REQUEST_TIMEOUT_MS = 5_000;

export interface NormalizedAbandonedLeadAlert {
  lead_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  tour_type: string | null;
  location: string | null;
  preferred_date: string | null;
  booking_step_last_seen: string | null;
  created_at: string | null;
}

interface DustinLeadAlertPayload extends NormalizedAbandonedLeadAlert {
  event: 'abandoned_lead_notify';
  meeting_location: string | null;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'AbortError' || error instanceof TypeError;
}

async function postLeadAlert(
  endpoint: string,
  payload: DustinLeadAlertPayload
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      console.error('[lead-alert] Dustin webhook responded with error:', response.status, responseText);
      return false;
    }

    return true;
  } finally {
    clearTimeout(timeout);
  }
}

export async function notifyDustinLeadAlert(
  lead: NormalizedAbandonedLeadAlert
): Promise<boolean> {
  const endpoint =
    process.env.N8N_DUSTIN_LEAD_ALERT_WEBHOOK_URL?.trim() ||
    DEFAULT_DUSTIN_LEAD_ALERT_WEBHOOK_URL;

  if (!endpoint) {
    return false;
  }

  const payload: DustinLeadAlertPayload = {
    event: 'abandoned_lead_notify',
    ...lead,
    meeting_location: getBookingLocationMeta(lead.location).meetingPointName,
  };

  try {
    return await postLeadAlert(endpoint, payload);
  } catch (error) {
    if (!isRetryableNetworkError(error)) {
      console.error('[lead-alert] Failed to notify Dustin:', error);
      return false;
    }

    console.warn('[lead-alert] Retrying Dustin webhook after network failure.');

    try {
      return await postLeadAlert(endpoint, payload);
    } catch (retryError) {
      console.error('[lead-alert] Retry failed for Dustin webhook:', retryError);
      return false;
    }
  }
}
