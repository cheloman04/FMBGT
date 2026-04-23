export const FLORIDA_MTB_TIME_ZONE = 'America/New_York';

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
