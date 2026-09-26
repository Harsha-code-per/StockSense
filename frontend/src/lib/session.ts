/** Session helpers shared by the route guard (src/proxy.ts) and the auth pages. */
export const SESSION_COOKIE = 'ss_session';
export const DEFAULT_AFTER_LOGIN = '/dashboard';

const AUTH_PAGES = ['/login', '/signup', '/forgot-password'];

/**
 * Where to go after signing in. Only same-site paths are allowed, so a crafted
 * `?next=//evil.example` or `?next=https://evil.example` can't turn login into an open redirect.
 */
export function safeNext(next: unknown): string {
  if (
    typeof next !== 'string' ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.includes('\\') ||
    AUTH_PAGES.some((page) => next === page || next.startsWith(`${page}?`))
  ) {
    return DEFAULT_AFTER_LOGIN;
  }
  return next;
}
