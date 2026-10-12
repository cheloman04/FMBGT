export function easternLocalToUtcIso(dateStr: string, localTime: string): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const [h, min] = localTime.split(':').map(Number) as [number, number];

  for (const offsetHours of [4, 5]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, h + offsetHours, min, 0));
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(candidate);
    const lh = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const lm = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    if ((lh === 24 ? 0 : lh) === h && lm === min) {
      return candidate.toISOString();
    }
  }

  return new Date(Date.UTC(y, m - 1, d, h + 4, min, 0)).toISOString();
}

export function addHoursToIso(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}


// Tours run in Florida, so a booking's `date` + `time_slot` are always Eastern
// wall-clock values — never the visitor's browser time zone.
const easternPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Eastern calendar date (YYYY-MM-DD) and wall-clock time (HH:MM) of an instant —
 * the inverse of easternLocalToUtcIso. Accepts UTC ("…Z") or offset ("…-04:00")
 * ISO strings; returns null for anything unparseable.
 */
export function utcIsoToEasternLocal(iso: string): { date: string; time: string } | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;

  const parts: Record<string, string> = {};
  for (const part of easternPartsFormatter.formatToParts(instant)) parts[part.type] = part.value;

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`,
  };
}

/** Today's date (YYYY-MM-DD) in Florida. */
export function easternToday(now: Date = new Date()): string {
  return utcIsoToEasternLocal(now.toISOString())!.date;
}
