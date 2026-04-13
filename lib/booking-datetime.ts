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

