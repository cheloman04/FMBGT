/**
 * Analytics utility — Florida Mountain Bike Guides booking funnel.
 *
 * Architecture: adapter-based. GA4 is the active adapter (Phase 1–2).
 * Future adapters (Phase 3+): GTM/dataLayer, Senzai v1 lifecycle event ingestion.
 *
 * EVENT MODEL DISTINCTION (BLUEPRINT_CLIENT_IMPLEMENTATION.md §12.3):
 *
 *   TRACKING EVENTS — behavioral/funnel signals — emitted here → GA4, future GTM/dataLayer
 *     These answer: "what did the user do?"
 *     Examples: booking_started, booking_step_completed, checkout_started, booking_completed
 *
 *   BUSINESS LIFECYCLE EVENTS — authoritative state transitions — emitted server-side → future Senzai
 *     These answer: "what did the system confirm?"
 *     Examples: booking.created, payment.deposit_succeeded, booking.confirmed
 *     These are NOT implemented in this file. They live in /api/webhooks and /api/create-checkout.
 *
 * TENANT CONFIG: Replace TENANT_CONFIG per derived Senzai client project.
 */

// ─── Tenant Config ────────────────────────────────────────────────────────────────
const TENANT_CONFIG = {
  tenant_name: 'florida_mountain_bike_guides',
  app_name: 'booking_funnel',
  funnel_name: 'tour_booking',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────────

export type TrackingParams = Record<string, string | number | boolean | undefined | null>;

export interface AcquisitionContext {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  /** Normalized canonical value — Blueprint §12.2 traffic_source vocabulary */
  traffic_source?: string;
  /** Normalized canonical value — Blueprint §12.2 traffic_medium vocabulary */
  traffic_medium?: string;
  referrer?: string;
  landing_page?: string;
}

export interface PurchaseItem {
  item_id: string;
  item_name: string;
  item_category: string;
  price: number;
  quantity: number;
}

export interface PurchaseParams {
  transaction_id: string;
  value: number;    // dollars (not cents)
  currency: string;
  items: PurchaseItem[];
  booking_id?: string;
  trail_type?: string;
  location_name?: string;
  marketing_source?: string;
}

// ─── Acquisition Context ──────────────────────────────────────────────────────────

const SESSION_KEY_ATTRIBUTION = 'senzai_attribution_v1';

// Blueprint §12.2 canonical source normalization
const SOURCE_NORMALIZATION: Record<string, string> = {
  google: 'google',
  facebook: 'meta',
  instagram: 'meta',
  fb: 'meta',
  ig: 'meta',
  youtube: 'youtube',
  bing: 'bing',
  tiktok: 'tiktok',
  email: 'email',
  '(direct)': 'direct',
};

// Blueprint §12.2 canonical medium normalization
const MEDIUM_NORMALIZATION: Record<string, string> = {
  cpc: 'cpc',
  ppc: 'cpc',
  paid_social: 'paid_social',
  social: 'organic_social',
  organic: 'organic_search',
  '(none)': 'direct',
  direct: 'direct',
  email: 'email',
  referral: 'referral',
};

function normalizeSource(raw: string | null | undefined): string {
  if (!raw || raw === '(none)') return 'direct';
  return SOURCE_NORMALIZATION[raw.toLowerCase()] ?? 'referral';
}

function normalizeMedium(raw: string | null | undefined): string {
  if (!raw || raw === '(none)') return 'direct';
  return MEDIUM_NORMALIZATION[raw.toLowerCase()] ?? raw.toLowerCase();
}

/**
 * Capture UTM parameters and referrer from the current URL. Call once on
 * landing page or booking entry. Subsequent calls return the cached value
 * so attribution is not overwritten mid-funnel.
 *
 * Stores in sessionStorage so the context survives the Stripe redirect round-trip.
 */
export function captureAcquisitionContext(): AcquisitionContext {
  if (typeof window === 'undefined') return {};

  try {
    const stored = sessionStorage.getItem(SESSION_KEY_ATTRIBUTION);
    if (stored) return JSON.parse(stored) as AcquisitionContext;
  } catch {
    // ignore parse error — re-capture below
  }

  const params = new URLSearchParams(window.location.search);
  const utm_source = params.get('utm_source') ?? undefined;
  const utm_medium = params.get('utm_medium') ?? undefined;
  const utm_campaign = params.get('utm_campaign') ?? undefined;
  const utm_term = params.get('utm_term') ?? undefined;
  const utm_content = params.get('utm_content') ?? undefined;

  const ctx: AcquisitionContext = {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    traffic_source: normalizeSource(utm_source),
    traffic_medium: normalizeMedium(utm_medium),
    referrer: document.referrer || undefined,
    landing_page: window.location.pathname + window.location.search || undefined,
  };

  try {
    sessionStorage.setItem(SESSION_KEY_ATTRIBUTION, JSON.stringify(ctx));
  } catch {
    // quota exceeded or private browsing — fail silently
  }

  return ctx;
}

/** Read attribution context without re-parsing the URL. */
export function getAcquisitionContext(): AcquisitionContext {
  if (typeof window === 'undefined') return {};
  try {
    const stored = sessionStorage.getItem(SESSION_KEY_ATTRIBUTION);
    return stored ? (JSON.parse(stored) as AcquisitionContext) : {};
  } catch {
    return {};
  }
}

// ─── GA4 client identity (server-side MP stitching) ─────────────────────────────────
// The GA4 `_ga` / `_ga_<stream>` cookies carry the real client_id + session_id that
// gtag uses to sessionize the browser. We persist these on the booking's attribution
// snapshot (alongside meta_fbc/meta_fbp) so the cookie-less server-side conversion
// (Stripe webhook → GA4 Measurement Protocol) can REPLAY them and attribute the
// purchase to the originating session/campaign instead of (direct). These parsers are
// pure (no window/cookie access) so the server route can run them on the raw cookie
// values it reads from the request — mirroring how it already reads `_fbc`/`_fbp`.

/** GA4 measurement ID — mirrors the value wired in app/layout.tsx. */
export const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-SMP4GWTYJW';

/** Name of the GA4 session cookie: `_ga_<container>`, container = measurement id minus "G-". */
export function gaSessionCookieName(measurementId: string = GA4_MEASUREMENT_ID): string {
  return `_ga_${measurementId.replace(/^G-/, '')}`;
}

/**
 * Extract the GA4 client_id from the raw `_ga` cookie value.
 * Format: `GA1.1.<clientId>.<firstVisitTs>` → returns `<clientId>.<firstVisitTs>`.
 */
export function parseGaClientId(rawGaCookie: string | null | undefined): string | null {
  if (!rawGaCookie) return null;
  const parts = rawGaCookie.split('.');
  if (parts.length < 4) return null;
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

/**
 * Extract the GA4 session_id from the raw `_ga_<stream>` cookie value.
 * Format: `GS1.1.<sessionId>.<n>…` (or `GS2.1.<sessionId>.…`) → returns `<sessionId>`.
 */
export function parseGaSessionId(rawGaStreamCookie: string | null | undefined): string | null {
  if (!rawGaStreamCookie) return null;
  return rawGaStreamCookie.split('.')[2] || null;
}

// ─── Adapter Interface ────────────────────────────────────────────────────────────

interface AnalyticsAdapter {
  name: string;
  send(eventName: string, params: Record<string, unknown>): void;
}

// ─── GA4 Adapter ─────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const ga4Adapter: AnalyticsAdapter = {
  name: 'ga4',
  send(eventName, params) {
    if (typeof window === 'undefined') return;
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', eventName, params);
  },
};

// ─── Active Adapters ──────────────────────────────────────────────────────────────
// Phase 1–2: GA4 only.
// Phase 3: push gtmAdapter and/or senzaiAdapter into this array.

const adapters: AnalyticsAdapter[] = [ga4Adapter];

// ─── Payload Builder ─────────────────────────────────────────────────────────────

function buildPayload(params?: TrackingParams): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    tenant_name: TENANT_CONFIG.tenant_name,
    app_name: TENANT_CONFIG.app_name,
    funnel_name: TENANT_CONFIG.funnel_name,
    // Senzai dictionary §8 behavioral param — the current URL path, attached to
    // every behavioral event so reports can segment by page. (callers may override)
    ...(typeof window !== 'undefined' ? { page_path: window.location.pathname } : {}),
    ...params,
  };
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }
  return payload;
}

// ─── Core track() ────────────────────────────────────────────────────────────────

/**
 * Fire a canonical TRACKING event through all active adapters.
 * Blueprint §12.3 canonical tracking vocabulary:
 *   page_view, cta_clicked, booking_started, booking_step_completed,
 *   checkout_started, booking_completed, etc.
 */
export function track(eventName: string, params?: TrackingParams): void {
  const payload = buildPayload(params);
  for (const adapter of adapters) {
    try {
      adapter.send(eventName, payload);
    } catch {
      // Tracking failures must never surface to users
    }
  }
}

// ─── Purchase / booking_completed ────────────────────────────────────────────────

const PURCHASE_DEDUP_PREFIX = 'analytics_booking_completed_';

/**
 * Fire the GA4 ecommerce `purchase` event and canonical `booking_completed` event.
 * Protected by session-scoped deduplication so page refreshes don't re-fire revenue.
 */
export function trackPurchase(params: PurchaseParams): void {
  if (typeof window === 'undefined') return;

  const dedupKey = `${PURCHASE_DEDUP_PREFIX}${params.booking_id ?? params.transaction_id}`;
  if (sessionStorage.getItem(dedupKey)) return;
  sessionStorage.setItem(dedupKey, '1');

  const acq = getAcquisitionContext();

  // GA4 standard ecommerce event — consumed by Google Ads for value-based bidding
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'purchase', {
      transaction_id: params.transaction_id,
      value: params.value,
      currency: params.currency,
      items: params.items,
      tenant_name: TENANT_CONFIG.tenant_name,
      app_name: TENANT_CONFIG.app_name,
      funnel_name: TENANT_CONFIG.funnel_name,
      booking_id: params.booking_id,
      trail_type: params.trail_type,
      location_name: params.location_name,
      marketing_source: params.marketing_source,
      traffic_source: acq.traffic_source,
      traffic_medium: acq.traffic_medium,
      utm_campaign: acq.utm_campaign,
    });
  }

  // Behavioral mirror of the purchase. Gap F: do NOT send `value`/`currency` here —
  // the `purchase` event above is the single revenue line. booking_completed fires at
  // the same moment with the same booking, so carrying `value` would double-count the
  // revenue in any exploration that sums "Event value" across events. Keep it as a
  // funnel-completion signal only (transaction_id stays for joinability, not revenue).
  track('booking_completed', {
    funnel_step: 'booking_completed',
    transaction_id: params.transaction_id,
    booking_id: params.booking_id,
    trail_type: params.trail_type,
    location_name: params.location_name,
    marketing_source: params.marketing_source,
    traffic_source: acq.traffic_source,
    traffic_medium: acq.traffic_medium,
    utm_campaign: acq.utm_campaign,
  });
}

// ─── Legacy shims ─────────────────────────────────────────────────────────────────
// Backward-compatible wrappers mapping the old GTM-based function names to the
// new track() API. Existing call sites (landing page, etc.) continue to work
// without requiring a full rename refactor.

export function trackEvent(eventName: string, params: Record<string, string | number | boolean | undefined> = {}): void {
  track(eventName, params);
}

export function trackCtaClick(buttonText: string, location: string): void {
  track('cta_clicked', { cta_text: buttonText, cta_location: location });
}

export function trackContactFormSubmit(): void {
  track('contact_form_submit', { cta_location: 'contact_form' });
}

export function trackSocialClick(platform: string): void {
  track('social_click', { platform, cta_location: 'social_link' });
}

export function trackBookingStart(source: string): void {
  track('cta_clicked', { cta_text: 'Book', cta_location: source, destination: '/booking' });
}

export function trackBookingStepComplete(stepNumber: number, stepName: string): void {
  // Senzai dictionary §8: funnel_step is the canonical dimension the funnel
  // exploration breaks down on (booking_step_* kept for backward-compat).
  track('booking_step_completed', {
    funnel_step: stepName,
    booking_step_number: stepNumber,
    booking_step_name: stepName,
  });
}

export function trackBookingCompleted(params: {
  tourType?: string;
  riderCount?: number;
  revenue?: number;
  transactionId?: string;
}): void {
  // Gap F: revenue belongs only on the `purchase` event (see trackPurchase).
  // `revenue` is intentionally not forwarded here so booking_completed is never
  // summed as a second revenue line.
  track('booking_completed', {
    funnel_step: 'booking_completed',
    trail_type: params.tourType,
    participant_count: params.riderCount,
    transaction_id: params.transactionId,
  });
}

export function captureUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const).forEach((key) => {
    const value = params.get(key);
    if (value) utm[key] = value;
  });
  return utm;
}
