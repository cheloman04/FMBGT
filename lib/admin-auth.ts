import { createClient, type Session } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const ADMIN_EMAIL = 'floridamountainbikeguides@gmail.com';
export const ADMIN_ACCESS_COOKIE = 'admin_access_token';
export const ADMIN_REFRESH_COOKIE = 'admin_refresh_token';

type CookieStoreLike = {
  get(name: string): { value: string } | undefined;
};

function getSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase auth environment variables are not configured');
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

export function isAuthorizedAdminEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === ADMIN_EMAIL;
}

export function applyAdminSessionCookies(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
  session: Session
) {
  const secure = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };

  response.cookies.set(ADMIN_ACCESS_COOKIE, session.access_token, cookieOptions);
  response.cookies.set(ADMIN_REFRESH_COOKIE, session.refresh_token, cookieOptions);
}

export function clearAdminSessionCookies(
  response: { cookies: { delete: (name: string) => void } }
) {
  response.cookies.delete(ADMIN_ACCESS_COOKIE);
  response.cookies.delete(ADMIN_REFRESH_COOKIE);
}

export async function getAdminUserFromCookieStore(
  cookieStore: CookieStoreLike
) {
  const accessToken = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  if (!isAuthorizedAdminEmail(data.user.email)) return null;

  return data.user;
}

export async function requireAdminUser() {
  const cookieStore = await cookies();
  const user = await getAdminUserFromCookieStore(cookieStore);
  if (!user) {
    redirect('/admin/login');
  }

  return user;
}
