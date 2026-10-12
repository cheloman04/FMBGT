export const FLORIDA_MTB_TIME_ZONE = 'America/New_York';
export const FLORIDA_TIME_ZONE_LABEL = 'Eastern Time (Florida)';

/**
 * "08:00" → "8:00 AM", or "8:00 AM ET" with `withZone`. A booking's time_slot is
 * Eastern wall-clock time, so it is formatted as-is, never converted.
 */
export function formatTourTime(timeSlot: string, { withZone = false } = {}) {
  const [hours, minutes] = timeSlot.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return timeSlot;

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const time = `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
  return withZone ? `${time} ET` : time;
}

export function formatFloridaCalendarDate(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }
) {
  const [year, month, day] = date.split('-').map(Number);

  if (!year || !month || !day) {
    return date;
  }

  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function formatFloridaDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: FLORIDA_MTB_TIME_ZONE,
  }).format(new Date(iso));
}

export function formatFloridaDateOnly(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: FLORIDA_MTB_TIME_ZONE,
  }).format(new Date(iso));
}

export function formatFloridaTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: FLORIDA_MTB_TIME_ZONE,
  }).format(new Date(iso));
}
