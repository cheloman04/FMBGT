import { describe, expect, it } from 'vitest';
import { bookingBikeCounts, lacksBikes } from './bike-counts';

describe('bookingBikeCounts', () => {
  it('counts one bike per rider who rents one', () => {
    expect(
      bookingBikeCounts({
        bike_rental: 'standard',
        participant_info: [{ bike_rental: 'electric' }, { bike_rental: 'none' }, { bike_rental: 'standard' }],
      })
    ).toEqual({ bikes: 3, electric: 1 });
  });

  it('takes no bikes when everyone brings their own', () => {
    expect(bookingBikeCounts({ bike_rental: 'none', participant_info: [{ bike_rental: 'none' }] })).toEqual({
      bikes: 0,
      electric: 0,
    });
  });

  it("gives manual-booking riders (names only) the lead rider's bike", () => {
    // Laura Walton's booking: 3 riders on standard bikes used to count as 1.
    expect(
      bookingBikeCounts({ bike_rental: 'standard', participant_info: [{ name: 'Rider 2' }, { name: 'Rider 3' }] })
    ).toEqual({ bikes: 3, electric: 0 });
    expect(bookingBikeCounts({ bike_rental: 'electric', participant_info: [{ name: 'Rider 2' }] })).toEqual({
      bikes: 2,
      electric: 2,
    });
  });

  it('handles a solo rider and malformed participant_info', () => {
    expect(bookingBikeCounts({ bike_rental: 'standard', participant_info: null })).toEqual({ bikes: 1, electric: 0 });
    expect(bookingBikeCounts({ bike_rental: 'standard', participant_info: '[{"name":"x"}]' })).toEqual({
      bikes: 1,
      electric: 0,
    });
    expect(bookingBikeCounts({ bike_rental: null })).toEqual({ bikes: 0, electric: 0 });
  });

  it('counts the legacy electric_upgrade add-on as an electric bike', () => {
    expect(bookingBikeCounts({ bike_rental: 'standard', addons: { electric_upgrade: true } })).toEqual({
      bikes: 1,
      electric: 1,
    });
    // ...but not twice when the lead already rides electric.
    expect(bookingBikeCounts({ bike_rental: 'electric', addons: { electric_upgrade: true } })).toEqual({
      bikes: 1,
      electric: 1,
    });
  });
});

describe('lacksBikes', () => {
  const fleet = { bikes: 10, electric: 2 };

  it('lets a second Sanford group in while bikes remain', () => {
    expect(lacksBikes(fleet, { bikes: 6, electric: 1 }, { bikes: 4, electric: 1 })).toBe(false);
  });

  it('turns a group away when the fleet or the e-bikes run out', () => {
    expect(lacksBikes(fleet, { bikes: 7, electric: 0 }, { bikes: 4, electric: 0 })).toBe(true);
    expect(lacksBikes(fleet, { bikes: 3, electric: 2 }, { bikes: 1, electric: 1 })).toBe(true);
  });
});
