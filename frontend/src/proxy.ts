import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

/**
 * Route guard: signed-out visitors to app pages go to /login?next=<page>.
 * It only checks that a session cookie exists; the API verifies the JWT on every
 * request, and an expired session is sent back to /login by lib/api.ts on 401.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  // '/' is public: it shows the landing page (or redirects signed-in users).
  matcher: [
    '/dashboard/:path*',
    '/products/:path*',
    '/operations/:path*',
    '/history/:path*',
    '/warehouses/:path*',
    '/profile/:path*',
  ],
};
