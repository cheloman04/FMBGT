import { describe, expect, it } from 'vitest';
import { loginPathFor, safeAdminPath } from './login-path';

describe('safeAdminPath', () => {
  it('keeps /admin pages, with their query', () => {
    expect(safeAdminPath('/admin')).toBe('/admin');
    expect(safeAdminPath('/admin/bookings/123?tab=money')).toBe('/admin/bookings/123?tab=money');
    expect(safeAdminPath('/admin?status=leads&leadId=abc')).toBe('/admin?status=leads&leadId=abc');
  });

  it('drops anything that is not an /admin page', () => {
    expect(safeAdminPath(null)).toBeNull();
    expect(safeAdminPath('')).toBeNull();
    expect(safeAdminPath('/')).toBeNull();
    expect(safeAdminPath('/administrator')).toBeNull();
    expect(safeAdminPath('//evil.example/admin')).toBeNull();
    expect(safeAdminPath('https://evil.example/admin')).toBeNull();
  });

  it('never sends someone back to a sign-in page', () => {
    expect(safeAdminPath('/admin/login')).toBeNull();
    expect(safeAdminPath('/admin/login?next=/admin')).toBeNull();
    expect(safeAdminPath('/admin/forgot-password')).toBeNull();
    expect(safeAdminPath('/admin/reset-password#token')).toBeNull();
  });
});

describe('loginPathFor', () => {
  it('carries the page and says the session expired', () => {
    expect(loginPathFor('/admin/gift-cards', { expired: true })).toBe(
      '/admin/login?expired=1&next=%2Fadmin%2Fgift-cards',
    );
  });

  it('falls back to a bare login when there is nothing safe to return to', () => {
    expect(loginPathFor(null, { expired: false })).toBe('/admin/login');
    expect(loginPathFor('/admin/login', { expired: true })).toBe('/admin/login?expired=1');
  });
});
