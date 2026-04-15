import type { AttributionPayload } from '@/types/booking';

export const UTM_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

export const EMAIL_ATTRIBUTION_PARAM_KEYS = [
  'flow',
  'sequence_key',
  'template_key',
  'step_key',
  'enrollment_id',
  'trail_type',
  'cta',
] as const;

function cleanParam(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function extractAttributionFromSearchParams(
  params: URLSearchParams
): AttributionPayload | undefined {
  const attribution: AttributionPayload = {
    utm_source: cleanParam(params.get('utm_source')),
    utm_medium: cleanParam(params.get('utm_medium')),
    utm_campaign: cleanParam(params.get('utm_campaign')),
    utm_content: cleanParam(params.get('utm_content')),
    utm_term: cleanParam(params.get('utm_term')),
    flow: cleanParam(params.get('flow')),
    sequence_key: cleanParam(params.get('sequence_key')),
    template_key: cleanParam(params.get('template_key')),
    step_key: cleanParam(params.get('step_key')),
    enrollment_id: cleanParam(params.get('enrollment_id')),
    trail_type: cleanParam(params.get('trail_type')) as AttributionPayload['trail_type'],
    cta: cleanParam(params.get('cta')),
  };

  const hasData = Object.values(attribution).some((value) => value !== undefined);
  if (!hasData) return undefined;

  return {
    ...attribution,
    captured_at: new Date().toISOString(),
  };
}

export function pickUtmFromAttribution(attribution?: AttributionPayload): {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
} {
  if (!attribution) return {};

  return {
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_content: attribution.utm_content,
    utm_term: attribution.utm_term,
  };
}
