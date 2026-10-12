import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_PATH_HEADER, loginPathFor } from '@/lib/admin/login-path';

const PUBLIC_ADMIN_PATHS = [
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!pathname.startsWith('/admin')) return NextResponse.next();
  if (PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const hasAuthToken = Boolean(req.cookies.get('admin_access_token')?.value);

  if (!hasAuthToken) {
    // `next` keeps the query too (`/admin?status=leads`), so signing in lands
    // on the same view.
    return NextResponse.redirect(new URL(loginPathFor(pathname + search, { expired: false }), req.url));
  }

  // The layout guard (`requireOperator`) can't see the URL; this header tells it
  // where to send the operator back to if the cookie turns out to be stale.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(ADMIN_PATH_HEADER, pathname + search);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/admin/:path*'],
};
