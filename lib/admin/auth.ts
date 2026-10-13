import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';
import { ADMIN_PATH_HEADER, loginPathFor } from './login-path';

/**
 * For /api/admin route handlers: the signed-in operator, or null.
 *
 * An API never redirects — it answers 401 and the kit's API client sends the
 * operator to the login page. Call it BEFORE any try/catch:
 *
 *   const operator = await getOperator();
 *   if (!operator) return unauthorized();
 *
 * (`requireAdminUser()` inside a try is how gift cards and referrals answered a
 * stale session with a 500: its redirect is a thrown error, and the catch ate it.)
 */
export async function getOperator() {
  return getAdminUserFromCookieStore(await cookies());
}

export function unauthorized() {
  return NextResponse.json({ error: 'Your session expired. Sign in again.' }, { status: 401 });
}

/**
 * The guard of the operator area (KIGARU_DASHBOARD_STANDARD_V1.md §5.4), called
 * from `app/admin/(panel)/layout.tsx`.
 *
 * The middleware already bounces a request with NO session cookie to the login
 * page. This catches the other case: a cookie that no longer validates (expired
 * or revoked), and sends the operator back to the page they were on once they
 * sign in again.
 */
export async function requireOperator() {
  const user = await getAdminUserFromCookieStore(await cookies());
  if (user) return user;
  const path = (await headers()).get(ADMIN_PATH_HEADER);
  redirect(loginPathFor(path, { expired: true }));
}
