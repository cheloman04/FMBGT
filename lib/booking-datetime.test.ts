import { describe, expect, it } from 'vitest';
import { easternLocalToUtcIso, easternToday, utcIsoToEasternLocal } from './booking-datetime';

describe('utcIsoToEasternLocal', () => {
  it('converts UTC instants to Florida wall-clock time on both sides of the DST switch', () => {
    // EDT (UTC-4) until Nov 1 2026, EST (UTC-5) after.
    expect(utcIsoToEasternLocal('2026-10-27T12:00:00.000Z')).toEqual({ date: '2026-10-27', time: '08:00' });
    expect(utcIsoToEasternLocal('2026-11-03T13:00:00.000Z')).toEqual({ date: '2026-11-03', time: '08:00' });
  });

  it('reads offset-aware ISO strings as the instant they denote, whatever the offset', () => {
    expect(utcIsoToEasternLocal('2026-10-27T09:00:00.000-04:00')).toEqual({ date: '2026-10-27', time: '09:00' });
    // The same instant written in Pacific time is still 9 AM in Florida.
    expect(utcIsoToEasternLocal('2026-10-27T06:00:00.000-07:00')).toEqual({ date: '2026-10-27', time: '09:00' });
  });

  it('uses the Eastern date near midnight, not the UTC date', () => {
    expect(utcIsoToEasternLocal('2026-10-28T02:30:00.000Z')).toEqual({ date: '2026-10-27', time: '22:30' });
    expect(utcIsoToEasternLocal('2026-10-28T04:00:00.000Z')).toEqual({ date: '2026-10-28', time: '00:00' });
  });

  it('returns null for an unparseable timestamp', () => {
    expect(utcIsoToEasternLocal('not a date')).toBeNull();
  });

  it('round-trips with easternLocalToUtcIso for tour start times', () => {
    for (const date of ['2026-07-04', '2026-10-31', '2026-11-01', '2026-12-15']) {
      for (const time of ['08:00', '09:00', '10:00', '11:30']) {
        expect(utcIsoToEasternLocal(easternLocalToUtcIso(date, time))).toEqual({ date, time });
      }
    }
  });
});

describe('easternToday', () => {
  it("is Florida's date even when it is already tomorrow in UTC", () => {
    expect(easternToday(new Date('2026-10-12T02:00:00.000Z'))).toBe('2026-10-11');
    expect(easternToday(new Date('2026-10-12T05:00:00.000Z'))).toBe('2026-10-12');
  });
});
