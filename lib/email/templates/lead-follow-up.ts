// lead_follow_up — the three emails to a lead who started a booking and didn't
// finish (1 hour, 1 day, 1 week after the operator starts the follow-up), each in
// a paved and a mountain-bike version.
//
// Ported from the n8n workflow "LEAD - Follow-Up Processor (Cron)"
// (IrG7sJyrfSj8y7e2): same subjects, copy, banners and booking link. Marketing:
// the shell adds the postal address and the one-click unsubscribe (contract §5.3).
// Without a first name, the subject and headline drop the name instead of
// starting with a comma.
//
// No imports but the shell: the tests load this as is.

import { marketingShell, marketingText, type MarketingEmail } from '../layout';

export type LeadFollowUpStepKey = '1_hour' | '1_day' | '1_week';
export type FollowUpTrail = 'paved' | 'mtb';

export type LeadFollowUpInput = {
  stepKey: LeadFollowUpStepKey;
  trailType: FollowUpTrail;
  firstName: string | null;
  /** Already a label ("Beginner"), or null. */
  skillLevel: string | null;
  locationName: string | null;
  enrollmentId: string;
  sequenceKey: string;
  /** The site's origin, e.g. https://www.floridamountainbikeguides.com */
  siteUrl: string;
};

const BANNER = (file: string) => `https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/email_banners/${file}`;

/** The "Complete my booking" link, with the same tracking the n8n workflow added. */
export function leadBookingUrl(input: LeadFollowUpInput): string {
  const templateKey = `${input.trailType}_${input.stepKey}`;
  const url = new URL('/booking', input.siteUrl);
  const params: Record<string, string> = {
    utm_source: 'email',
    utm_medium: 'lifecycle_email',
    utm_campaign: 'lead_recovery',
    utm_content: templateKey,
    flow: 'lead_followup',
    sequence_key: input.sequenceKey,
    template_key: templateKey,
    step_key: input.stepKey,
    enrollment_id: input.enrollmentId,
    trail_type: input.trailType,
    cta: 'complete_my_booking',
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** "Maria, x" or "X" — never a headline that starts with a comma. */
function named(first: string | null, withName: (n: string) => string, without: string): string {
  return first ? withName(first) : without;
}

const PAVED_LOCATION_FALLBACK = 'Choose Downtown Sanford or Blue Springs Trail';
const MTB_LOCATION_FALLBACK = 'Florida MTB Trails';
const PAVED_FOOTER = { line1: 'Guided Trail Experiences in Central Florida', line2: 'You’re receiving this because you started planning a ride with us.' };
const MTB_FOOTER = { line1: 'Guided MTB Experiences in Florida', line2: 'You’re receiving this because you started planning a ride with us.' };
const NO_EXPERIENCE = {
  title: 'No experience? Perfect.',
  paragraphs: [
    'You do not need to be an expert rider. Our guided experiences are designed for beginners, casual riders, and experienced shredders alike. If you bring the attitude, we’ll handle the rest.',
  ],
};

function pavedDetails(i: LeadFollowUpInput): Array<[string, string]> {
  return [
    ['Experience', 'Guided Paved Trail Ride'],
    ['Location', i.locationName || PAVED_LOCATION_FALLBACK],
  ];
}

function mtbDetails(i: LeadFollowUpInput, skillFallback: string): Array<[string, string]> {
  return [
    ['Experience', 'Guided Mountain Bike Ride'],
    ['Skill Level', i.skillLevel || skillFallback],
    ['Location', i.locationName || MTB_LOCATION_FALLBACK],
  ];
}

type Variant = { subject: (first: string | null) => string; email: (i: LeadFollowUpInput, url: string) => MarketingEmail };

const VARIANTS: Record<`${FollowUpTrail}_${LeadFollowUpStepKey}`, Variant> = {
  paved_1_hour: {
    subject: (f) => named(f, (n) => `Still thinking it over, ${n}? Let’s get your ride booked 🌿`, 'Still thinking it over? Let’s get your ride booked 🌿'),
    email: (i, url) => ({
      title: 'Plan Your Ride',
      tagline: 'Guided Trail Experiences',
      banner: { src: BANNER('booking-paved-main.png'), alt: 'Paved trail ride' },
      eyebrow: 'Your ride is still waiting',
      headline: named(i.firstName, (n) => `${n}, ready to finish planning your paved trail ride?`, 'Ready to finish planning your paved trail ride?'),
      intro:
        'We noticed you were exploring one of our guided paved trail experiences but didn’t finish booking. Your ride is still within reach, and we’d love to help you get it locked in.',
      details: pavedDetails(i),
      value: {
        title: 'Why guests love this experience',
        paragraphs: [
          'Easygoing scenic routes, fresh air, local charm, and a guided experience that keeps things simple from start to finish. It’s a great way to explore Florida without the stress of figuring everything out on your own.',
        ],
      },
      cta: { title: 'Pick up where you left off', body: 'Complete your booking and let’s get your ride on the calendar.', label: 'Complete My Booking', url },
      closing: {
        title: 'Your next outdoor adventure is one click away',
        body: 'Secure your spot today and let us handle the rest. Scenic views, fresh air, and a guided ride through one of Florida’s best trails await.',
      },
      footer: PAVED_FOOTER,
    }),
  },
  paved_1_day: {
    subject: (f) => named(f, (n) => `${n}, your paved trail ride is waiting for you 🌴`, 'Your paved trail ride is waiting for you 🌴'),
    email: (i, url) => ({
      title: 'Your Ride Is Waiting',
      tagline: 'Guided Trail Experiences',
      banner: { src: BANNER('booking-paved-blue.png'), alt: 'Paved trail ride' },
      eyebrow: 'A peaceful ride through real Florida',
      headline: named(i.firstName, (n) => `${n}, your paved trail experience is still waiting`, 'Your paved trail experience is still waiting'),
      intro:
        'Whether you’re looking for a scenic ride through Downtown Sanford or a refreshing trail experience near Blue Spring, your guided ride is still just a few clicks away.',
      details: pavedDetails(i),
      value: {
        title: 'Why this ride stands out',
        paragraphs: [
          'This experience is made for riders who want something easy, scenic, and memorable. You get a guided outdoor adventure with less hassle, beautiful surroundings, and a ride that feels relaxed from the moment you arrive.',
        ],
      },
      confidence: {
        title: 'Fresh air, scenic views, and a ride worth remembering',
        body: 'This is the kind of experience people book to slow down, explore more, and enjoy Florida in a way that feels active without feeling rushed.',
      },
      cta: { title: 'Lock in your ride', body: 'Pick up where you left off and secure your guided paved trail experience today.', label: 'Complete My Booking', url },
      footer: PAVED_FOOTER,
    }),
  },
  paved_1_week: {
    subject: (f) => named(f, (n) => `Last reminder ${n}, complete your paved trail adventure 🚴‍♂️`, 'Last reminder: complete your paved trail adventure 🚴‍♂️'),
    email: (i, url) => ({
      title: 'One Last Reminder',
      tagline: 'Guided Trail Experiences',
      banner: { src: BANNER('signature-exp-2.png'), alt: 'Paved trail ride' },
      eyebrow: 'One last reminder',
      headline: named(i.firstName, (n) => `${n}, your ride is still here when you're ready`, "Your ride is still here when you're ready"),
      intro:
        'We wanted to send one final reminder in case life got busy. Your guided paved trail experience is still available, and we’d love to help you enjoy one of Florida’s best outdoor rides.',
      details: pavedDetails(i),
      value: {
        title: 'Why guests book this ride',
        paragraphs: ['Fresh air, beautiful scenery, local charm, and an easygoing guided experience that makes exploring Central Florida simple and memorable.'],
      },
      cta: { title: 'Ready when you are', body: 'If this adventure still sounds like your kind of day, your booking is only a few clicks away.', label: 'Book My Ride', url },
      footer: PAVED_FOOTER,
    }),
  },
  mtb_1_hour: {
    subject: (f) => named(f, (n) => `${n}, your MTB adventure is waiting 🔥🚵`, 'Your MTB adventure is waiting 🔥🚵'),
    email: (i, url) => ({
      title: 'Your MTB Ride Is Waiting',
      tagline: 'MTB Guided Experiences',
      banner: { src: BANNER('mtb.png'), alt: 'Mountain bike adventure' },
      eyebrow: 'Adventure starts here',
      headline: named(i.firstName, (n) => `${n}, your MTB ride is waiting 🔥`, 'Your MTB ride is waiting 🔥'),
      intro:
        'You were just steps away from booking an unforgettable mountain bike experience. Fast trails, real adventure, and a guided ride built around your comfort level.',
      details: mtbDetails(i, 'Any level welcome'),
      value: NO_EXPERIENCE,
      cta: { title: 'Let’s get you on the trail', body: 'Finish your booking and experience Florida in the most exciting way possible.', label: 'Complete My Booking', url },
      footer: MTB_FOOTER,
    }),
  },
  mtb_1_day: {
    subject: (f) => named(f, (n) => `${n}, if you can ride a bike, you can do this 🚵‍♂️`, 'If you can ride a bike, you can do this 🚵‍♂️'),
    email: (i, url) => ({
      title: 'No Experience Required',
      tagline: 'MTB Guided Experiences',
      banner: { src: BANNER('gallery-9.png'), alt: 'Mountain bike adventure' },
      eyebrow: 'No experience required',
      headline: named(i.firstName, (n) => `${n}, if you can ride a bike, you can do this`, 'If you can ride a bike, you can do this'),
      intro:
        'A lot of people think mountain biking is only for experts. It’s not. Our guided rides are built around your comfort level, so you can enjoy the thrill without the pressure.',
      details: mtbDetails(i, 'Beginner to Advanced'),
      value: NO_EXPERIENCE,
      cta: { title: 'Let’s get you on the trail', body: 'Finish your booking and experience Florida in the most exciting way possible.', label: 'Complete My Booking', url },
      footer: MTB_FOOTER,
    }),
  },
  mtb_1_week: {
    subject: (f) => named(f, (n) => `${n}, One last reminder: the trail is still waiting 🚵‍♂️`, 'One last reminder: the trail is still waiting 🚵‍♂️'),
    email: (i, url) => ({
      title: 'One Last Reminder',
      tagline: 'MTB Guided Experiences',
      banner: { src: BANNER('trail-type-mtb.png'), alt: 'Mountain bike adventure' },
      eyebrow: 'One last reminder',
      headline: named(i.firstName, (n) => `${n}, the trail is still waiting for you`, 'The trail is still waiting for you'),
      intro:
        'We know life gets busy, so we wanted to send one final reminder. If adventure has still been calling your name, your guided mountain bike experience is only a few clicks away.',
      details: mtbDetails(i, 'Any level welcome'),
      value: {
        title: 'Why people book this ride',
        paragraphs: ['Because it’s exciting, different, and unforgettable. You’ll challenge yourself, laugh a lot, and leave with a story worth telling.'],
      },
      confidence: { title: 'No expert skills required', body: 'If you can ride a bike and want a real experience, you’re ready enough for this.' },
      cta: { title: 'Ready when you are', body: 'Book now and let’s turn curiosity into an unforgettable ride.', label: 'Book My MTB Ride', url },
      footer: MTB_FOOTER,
    }),
  },
};

export function renderLeadFollowUp(input: LeadFollowUpInput): { subject: string; html: string; text: string } {
  const variant = VARIANTS[`${input.trailType}_${input.stepKey}`];
  if (!variant) throw new Error(`No lead follow-up template for ${input.trailType}_${input.stepKey}`);
  const email = variant.email(input, leadBookingUrl(input));
  return { subject: variant.subject(input.firstName), html: marketingShell(email), text: marketingText(email) };
}
