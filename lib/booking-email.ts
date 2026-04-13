import { getBookingLocationMeta } from '@/lib/location-meta';

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function toIcsTimestamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildMeetingLocationUrl(locationName: string): string {
  return getBookingLocationMeta(locationName).meetingPointUrl;
}

export function formatTrailType(trailType: string): string {
  return trailType === 'mtb' ? 'Mountain Bike' : 'Paved Trail';
}

export function formatSkillLevel(skillLevel: string | null | undefined): string {
  if (!skillLevel) return 'All levels';

  const labels: Record<string, string> = {
    first_time: 'First Time',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };

  return labels[skillLevel] ?? skillLevel;
}

export function buildBookingIcs(params: {
  bookingId: string;
  customerName: string;
  trailType: string;
  locationName: string;
  date: string;
  time: string;
  startIso: string;
  endIso: string;
  durationHours: number;
  participantCount: number;
  appUrl: string;
}): string {
  const summary = `${formatTrailType(params.trailType)} - Florida Mountain Bike Guides`;
  const locationMeta = getBookingLocationMeta(params.locationName);
  const description =
    `Booking ID: ${params.bookingId}\\n` +
    `Guest: ${params.customerName}\\n` +
    `Location: ${params.locationName}\\n` +
    `Date: ${params.date}\\n` +
    `Time: ${params.time}\\n` +
    `Duration: ${params.durationHours} hour(s)\\n` +
    `Riders: ${params.participantCount}\\n` +
    `Meeting point: ${locationMeta.meetingPointName}\\n` +
    `Meeting address: ${locationMeta.meetingPointAddress}\\n` +
    `Map: ${locationMeta.meetingPointUrl}\\n` +
    `Manage booking: ${params.appUrl}/booking/lookup`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Florida Mountain Bike Guides//Booking Confirmation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${params.bookingId}@floridamtbguides.com`,
    `DTSTAMP:${toIcsTimestamp(new Date().toISOString())}`,
    `DTSTART:${toIcsTimestamp(params.startIso)}`,
    `DTEND:${toIcsTimestamp(params.endIso)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(locationMeta.meetingPointAddress)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
