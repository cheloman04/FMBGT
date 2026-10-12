// Where to send an operator whose session is gone: the login page, carrying the
// page they were on (`next`) and, when a session existed but no longer
// validates, `expired=1` so the login page can say why.
//
// Pure on purpose (no imports): the layout guard and its test share it.

/** The header the middleware sets with the requested /admin path and query. */
export const ADMIN_PATH_HEADER = 'x-admin-path';

const PUBLIC_PAGES = /^\/admin\/(?:login|forgot-password|reset-password)(?:[/?#]|$)/;

/** `path` if it is an /admin page worth returning to, else null. */
export function safeAdminPath(path: string | null | undefined): string | null {
  if (!path || !/^\/admin(?:[/?#]|$)/.test(path)) return null;
  if (PUBLIC_PAGES.test(path)) return null;
  return path;
}

export function loginPathFor(path: string | null | undefined, { expired }: { expired: boolean }): string {
  const params = new URLSearchParams();
  if (expired) params.set('expired', '1');
  const next = safeAdminPath(path);
  if (next) params.set('next', next);
  const query = params.toString();
  return query ? `/admin/login?${query}` : '/admin/login';
}
