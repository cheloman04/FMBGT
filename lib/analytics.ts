/**
 * analytics.ts
 *
 * Thin wrapper around window.dataLayer (GTM).
 * All events pushed here are picked up by GTM and forwarded to
 * GA4, Meta Pixel, Google Ads, or any other tag configured in GTM.
 *
 * Usage:
 *   import { trackCtaClick } from '@/lib/analytics';
 *   <button onClick={() => trackCtaClick('Book a Guide', 'hero')}>
 *
 * To activate:
 *   1. Set NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX in .env.local
 *   2. In GTM, create triggers for event names defined below
 *   3. Attach GA4, Meta Pixel, and Google Ads tags to those triggers
 */

// ─────────────────────────────────────────────────────────────────
// Extend Window for TypeScript
// ─────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

type EventParams = Record<string, string | number | boolean | undefined>;

// ─────────────────────────────────────────────────────────────────
// Core push — all events go through here
// ─────────────────────────────────────────────────────────────────
export function trackEvent(eventName: string, params: EventParams = {}): void {
  if (typeof window === 'undefined') return; // SSR guard

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event: eventName, ...params });
}

// ─────────────────────────────────────────────────────────────────
// Phase 1 — Active events
// ─────────────────────────────────────────────────────────────────

/**
 * Fires when any primary CTA ("Book a Guide", "Book a Tour") is clicked.
 * @param buttonText  Visible label on the button
 * @param location    Section where the button lives: 'hero' | 'nav' | 'tours' | 'cta_banner' | 'guides'
 */
export function trackCtaClick(buttonText: string, location: string): void {
  trackEvent('cta_click', {
    button_text: buttonText,
    location,
    page: 'landing',
  });
}

/**
 * Fires when the contact form Submit button is clicked.
 */
export function trackContactFormSubmit(): void {
  trackEvent('contact_form_submit', {
    form_name: 'contact',
    page: 'landing',
  });
}

/**
 * Fires when any link navigates to /booking.
 * @param source  Which section triggered the navigation
 */
export function trackBookingStart(source: string): void {
  trackEvent('booking_start', {
    source,
    page: 'landing',
  });
}

/**
 * Fires when a social icon is clicked.
 * @param platform  'facebook' | 'instagram' | 'threads' | 'youtube'
 */
export function trackSocialClick(platform: string): void {
  trackEvent('social_click', {
    platform,
    page: 'landing',
  });
}

// ─────────────────────────────────────────────────────────────────
// Phase 2 — Booking funnel events (wire in booking step pages)
// ─────────────────────────────────────────────────────────────────

/**
 * Fires when a booking step is completed.
 * Call from each app/booking/step* page's onNext handler.
 */
export function trackBookingStepComplete(stepNumber: number, stepName: string): void {
  trackEvent('booking_step_complete', {
    step_number: stepNumber,
    step_name: stepName,
  });
}

/**
 * Fires on /booking/confirmation page load.
 * Triggers GA4 purchase event, Meta Pixel Purchase, Google Ads conversion.
 */
export function trackBookingCompleted(params: {
  tourType?: string;
  riderCount?: number;
  revenue?: number;
  transactionId?: string;
}): void {
  trackEvent('booking_completed', {
    tour_type: params.tourType,
    rider_count: params.riderCount,
    revenue: params.revenue,
    transaction_id: params.transactionId,
    currency: 'USD',
  });
}

// ─────────────────────────────────────────────────────────────────
// Phase 3 — Engagement events (add via GTM scroll trigger or useEffect)
// ─────────────────────────────────────────────────────────────────

/**
 * Fires at 25 / 50 / 75 / 90% scroll depth.
 * Recommended: configure in GTM using Scroll Depth trigger type
 * instead of wiring manually — GTM handles this natively.
 */
export function trackScrollDepth(depthPct: 25 | 50 | 75 | 90): void {
  trackEvent('scroll_depth', {
    depth_pct: depthPct,
    page: 'landing',
  });
}

/**
 * Fires when a trail card is opened in the interactive map carousel.
 */
export function trackTrailView(trailName: string, difficulty: string): void {
  trackEvent('trail_view', {
    trail_name: trailName,
    difficulty,
    page: 'landing',
  });
}

// ─────────────────────────────────────────────────────────────────
// UTM capture — call once on page load to store UTM params
// ─────────────────────────────────────────────────────────────────

/**
 * Reads UTM parameters from the current URL.
 * GTM reads these automatically via built-in URL variables,
 * but this utility is available if you want to store them in
 * Supabase alongside a booking or contact form submission.
 *
 * Example:
 *   const utms = captureUtmParams();
 *   // { utm_source: 'facebook', utm_medium: 'paid_social', ... }
 */
export function captureUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};

  (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const).forEach(
    (key) => {
      const value = params.get(key);
      if (value) utm[key] = value;
    },
  );

  return utm;
}
