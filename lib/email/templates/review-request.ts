// review_request — the three emails asking a guest for a review after a completed
// ride (same day, 1 day, 1 week after completion), in a paved and a mountain-bike
// version.
//
// Ported from the n8n workflow "COMPLETED_SERVICES_Review_Flow" (9jxUFqNkjbBA1YZm):
// same subjects, copy, banners and review link (the app's /review page, which
// forwards to Google). Marketing: the shell adds the postal address and the
// one-click unsubscribe (contract §5.3). The "1 day MTB" subject used the guest's
// FULL name in n8n; here every subject uses the first name.
//
// No imports but the shell: the tests load this as is.

import { marketingShell, marketingText, type MarketingEmail } from '../layout';
import type { FollowUpTrail } from './lead-follow-up';

export type ReviewStepKey = 'same_day' | '1_day' | '1_week';

export type ReviewRequestInput = {
  stepKey: ReviewStepKey;
  trailType: FollowUpTrail;
  firstName: string | null;
  locationName: string | null;
  enrollmentId: string;
  bookingId: string;
  sequenceKey: string;
  siteUrl: string;
};

const BANNER = (file: string) => `https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/email_banners/${file}`;

/** The "Leave my review" link: the app's /review page, with the tracking the n8n workflow added. */
export function reviewUrl(input: ReviewRequestInput): string {
  const templateKey = `${input.trailType}_${input.stepKey}`;
  const url = new URL('/review', input.siteUrl);
  const params: Record<string, string | null> = {
    utm_source: 'email',
    utm_medium: 'lifecycle_email',
    utm_campaign: 'review_request',
    utm_content: templateKey,
    flow: 'review_request',
    sequence_key: input.sequenceKey,
    template_key: templateKey,
    step_key: input.stepKey,
    enrollment_id: input.enrollmentId,
    booking_id: input.bookingId,
    trail_type: input.trailType,
    location_name: input.locationName,
    first_name: input.firstName,
    cta: 'leave_google_review',
  };
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

function named(first: string | null, withName: (n: string) => string, without: string): string {
  return first ? withName(first) : without;
}

const FOOTER = { line1: 'Thanks for supporting local adventure', line2: 'We hope to ride with you again soon.' };
const PAVED = 'Paved Trail Experiences';
const MTB = 'MTB Guided Experiences';

type Variant = { subject: (first: string | null) => string; email: (i: ReviewRequestInput, url: string) => MarketingEmail };

const VARIANTS: Record<`${FollowUpTrail}_${ReviewStepKey}`, Variant> = {
  paved_same_day: {
    subject: () => 'Thanks for riding with us today — quick favor? 🌿',
    email: (i, url) => ({
      title: 'Thanks For Riding With Us',
      tagline: PAVED,
      banner: { src: BANNER('booking-paved-main.png'), alt: 'Paved trail ride' },
      eyebrow: 'Thanks for riding with us',
      headline: named(i.firstName, (n) => `${n}, we hope you loved the ride`, 'We hope you loved the ride'),
      intro:
        'Thanks again for spending part of your day with Florida Mountain Bike Guides. We hope your ride was relaxing, memorable, and filled with the kind of views that make you want to do it again.',
      value: {
        title: 'Quick favor?',
        paragraphs: [
          'If you enjoyed your experience, we’d really appreciate a quick review. It helps future guests feel confident booking with us and helps our small local business continue growing.',
          'It only takes a minute, and it means a lot.',
        ],
      },
      cta: { title: 'Leave a Review', body: 'Your feedback helps more people discover these rides.', label: 'Leave My Review', url },
      footer: FOOTER,
    }),
  },
  paved_1_day: {
    subject: (f) => named(f, (n) => `${n}, how was yesterday’s ride? 🚴‍♂️⭐`, 'How was yesterday’s ride? 🚴‍♂️⭐'),
    email: (i, url) => ({
      title: 'How Was Your Ride?',
      tagline: PAVED,
      banner: { src: BANNER('booking-paved-blue.png'), alt: 'Paved trail ride' },
      eyebrow: 'Hope you enjoyed the ride',
      headline: named(i.firstName, (n) => `${n}, how was your experience?`, 'How was your experience?'),
      intro:
        'We hope yesterday’s ride gave you fresh air, great scenery, and a memorable way to explore Florida. Thanks again for choosing to ride with us.',
      value: {
        title: 'Your feedback helps future guests',
        paragraphs: [
          'Every review helps others feel confident booking their own ride and helps our small local business continue creating great outdoor experiences.',
          'If you have a minute, we’d truly appreciate your feedback.',
        ],
      },
      cta: { title: 'Share Your Experience', body: 'It only takes a minute and helps more than you know.', label: 'Leave My Review', url },
      footer: FOOTER,
    }),
  },
  paved_1_week: {
    subject: (f) => named(f, (n) => `Your feedback would mean a lot to us, ${n} 🙌`, 'Your feedback would mean a lot to us 🙌'),
    email: (i, url) => ({
      title: 'One Last Follow-up',
      tagline: PAVED,
      banner: { src: BANNER('signature-exp-2.png'), alt: 'Paved trail ride' },
      eyebrow: 'One last follow-up',
      headline: named(i.firstName, (n) => `${n}, would you mind sharing your experience?`, 'Would you mind sharing your experience?'),
      intro:
        'We know life gets busy, so this will be our last little nudge. If you enjoyed your ride with us, a quick review would go a long way.',
      value: {
        title: 'Your review helps more than you think',
        paragraphs: [
          'It helps future guests feel confident choosing us, and it helps our small business continue creating memorable outdoor experiences here in Florida.',
          'If you have a minute, we’d really appreciate your feedback.',
        ],
      },
      cta: { title: 'Leave a Quick Review', body: 'It only takes a minute, and we’d be genuinely grateful.', label: 'Leave My Review', url },
      footer: FOOTER,
    }),
  },
  mtb_same_day: {
    subject: () => 'You crushed it today — mind sharing a quick review? 🔥',
    email: (i, url) => ({
      title: 'Thanks For Riding With Us',
      tagline: MTB,
      banner: { src: BANNER('gallery-9.png'), alt: 'Mountain bike adventure' },
      eyebrow: 'Thanks for riding with us',
      headline: named(i.firstName, (n) => `${n}, you crushed it today 🔥`, 'You crushed it today 🔥'),
      intro:
        'We hope you had an unforgettable time on the trails today. Whether it was your first MTB ride or your hundredth, it means a lot that you chose to ride with us.',
      value: {
        title: 'Quick favor?',
        paragraphs: [
          'Reviews help other riders feel confident booking their own adventure, and they help small local businesses like ours grow.',
          'If you enjoyed your experience, we’d truly appreciate a quick review.',
        ],
      },
      cta: { title: 'Leave a Review', body: 'It only takes a minute, and it helps more than you know.', label: 'Leave My Review', url },
      footer: FOOTER,
    }),
  },
  mtb_1_day: {
    subject: (f) => named(f, (n) => `${n}, still smiling from yesterday’s ride? 🚵⭐`, 'Still smiling from yesterday’s ride? 🚵⭐'),
    email: (i, url) => ({
      title: 'How Was The Ride?',
      tagline: MTB,
      banner: { src: BANNER('mtb.png'), alt: 'Mountain bike adventure' },
      eyebrow: "Hope you're still smiling",
      headline: named(i.firstName, (n) => `${n}, how was the ride?`, 'How was the ride?'),
      intro:
        'We hope yesterday’s adventure left you with great memories, a little adrenaline, and maybe a few stories worth telling.',
      value: {
        title: 'Your feedback helps more riders discover us',
        paragraphs: [
          'Every review helps future guests feel confident booking their own adventure and helps our small business continue doing what we love.',
          'If you enjoyed your experience, we’d really appreciate a quick review.',
        ],
      },
      cta: { title: 'Share Your Experience', body: 'It only takes a minute and helps more than you know.', label: 'Leave My Review', url },
      footer: { line1: FOOTER.line1, line2: 'We’d love to ride with you again soon.' },
    }),
  },
  mtb_1_week: {
    subject: (f) => named(f, (n) => `${n}, still willing to share your MTB experience? 🚵`, 'Still willing to share your MTB experience? 🚵'),
    email: (i, url) => ({
      title: 'One Last Follow-up',
      tagline: MTB,
      banner: { src: BANNER('trail-type-mtb.png'), alt: 'Mountain bike adventure' },
      eyebrow: 'One last follow-up',
      headline: named(i.firstName, (n) => `${n}, would you mind sharing your experience?`, 'Would you mind sharing your experience?'),
      intro:
        'We know life gets busy, so this will be our last little nudge. If you enjoyed your ride with us, a quick review would go a long way.',
      value: {
        title: 'Your review helps more than you think',
        paragraphs: [
          'It helps future riders feel confident choosing us, and it helps our small business continue creating memorable outdoor experiences here in Florida.',
          'If you have a minute, we’d really appreciate your feedback.',
        ],
      },
      cta: { title: 'Leave a Quick Review', body: 'It only takes a minute, and we’d be genuinely grateful.', label: 'Leave My Review', url },
      footer: FOOTER,
    }),
  },
};

export function renderReviewRequest(input: ReviewRequestInput): { subject: string; html: string; text: string } {
  const variant = VARIANTS[`${input.trailType}_${input.stepKey}`];
  if (!variant) throw new Error(`No review request template for ${input.trailType}_${input.stepKey}`);
  const email = variant.email(input, reviewUrl(input));
  return { subject: variant.subject(input.firstName), html: marketingShell(email), text: marketingText(email) };
}
