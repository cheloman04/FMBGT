import { getBookingLocationMeta } from '@/lib/location-meta';

const DEFAULT_COMPLETED_SERVICE_WEBHOOK_URL =
  'https://fmbgt-n8n.yvjziu.easypanel.host/webhook/completed-service';
const REQUEST_TIMEOUT_MS = 5_000;

export interface CompletedServiceAlert {
  booking_id: string;
  customer_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  trail_type: string | null;
  skill_level: string | null;
  location_name: string | null;
  meeting_location: string | null;
  meeting_address: string | null;
  meeting_url: string | null;
  date: string | null;
  time_slot: string | null;
  duration_hours: number | null;
  bike_rental: string | null;
  participant_count: number | null;
  total_price: number | null;
  status: string;
  completed_at: string;
}

interface CompletedServicePayload extends CompletedServiceAlert {
  event: 'completed_service';
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'AbortError' || error instanceof TypeError;
}

async function postCompletedServiceAlert(
  endpoint: string,
  payload: CompletedServicePayload
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
      console.error(
        '[completed-service-alert] Webhook responded with error:',
        response.status,
        responseText
      );
      return false;
    }

    return true;
  } finally {
    clearTimeout(timeout);
  }
}

export async function notifyCompletedService(
  booking: CompletedServiceAlert
): Promise<boolean> {
  const endpoint =
    process.env.N8N_COMPLETED_SERVICE_WEBHOOK_URL?.trim() ||
    DEFAULT_COMPLETED_SERVICE_WEBHOOK_URL;

  if (!endpoint) {
    return false;
  }

  const meeting = getBookingLocationMeta(booking.location_name);
  const payload: CompletedServicePayload = {
    event: 'completed_service',
    ...booking,
    meeting_location: meeting.meetingPointName,
    meeting_address: meeting.meetingPointAddress,
    meeting_url: meeting.meetingPointUrl,
  };

  try {
    return await postCompletedServiceAlert(endpoint, payload);
  } catch (error) {
    if (!isRetryableNetworkError(error)) {
      console.error('[completed-service-alert] Failed to notify webhook:', error);
      return false;
    }

    console.warn('[completed-service-alert] Retrying webhook after network failure.');

    try {
      return await postCompletedServiceAlert(endpoint, payload);
    } catch (retryError) {
      console.error('[completed-service-alert] Retry failed:', retryError);
      return false;
    }
  }
}
