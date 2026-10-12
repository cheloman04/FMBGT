import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';
import { ADMIN_PATH_HEADER, loginPathFor } from './login-path';

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
