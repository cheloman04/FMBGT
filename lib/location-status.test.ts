import { describe, expect, it } from 'vitest';
import { isLocationComingSoon } from './location-status';

describe('isLocationComingSoon', () => {
  it('matches Blue Spring whichever dash the stored name uses', () => {
    expect(isLocationComingSoon('Spring to Spring Trail Tour - Blue Spring State Park')).toBe(true);
    expect(isLocationComingSoon('Spring to Spring Trail Tour – Blue Spring State Park')).toBe(true);
    expect(isLocationComingSoon('  spring to spring trail tour – blue spring state park ')).toBe(true);
  });

  it('leaves bookable locations alone', () => {
    expect(isLocationComingSoon('Sanford Historic Riverfront Tour')).toBe(false);
    expect(isLocationComingSoon('Markham Woods Trail, Lake Mary')).toBe(false);
    expect(isLocationComingSoon(null)).toBe(false);
    expect(isLocationComingSoon(undefined)).toBe(false);
    expect(isLocationComingSoon('')).toBe(false);
  });
});
