import { describe, expect, it } from 'vitest';
import { formatTourTime } from './display-time';

describe('formatTourTime', () => {
  it('formats a stored Eastern time_slot as-is, with an ET label on request', () => {
    expect(formatTourTime('08:00')).toBe('8:00 AM');
    expect(formatTourTime('08:00', { withZone: true })).toBe('8:00 AM ET');
    expect(formatTourTime('12:30')).toBe('12:30 PM');
    expect(formatTourTime('00:15')).toBe('12:15 AM');
    expect(formatTourTime('22:30')).toBe('10:30 PM');
  });

  it('passes through a value that is not HH:MM', () => {
    expect(formatTourTime('morning')).toBe('morning');
  });
});
