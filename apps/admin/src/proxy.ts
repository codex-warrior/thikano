import { NextResponse, type NextRequest } from 'next/server';

/**
 * Optimistic gate only: no session cookie → sign-in page. The cookie is fully verified
 * (signature + revocation + membership) in server code on every request.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has('__session')) {
    const url = new URL('/login', request.url);
    if (request.nextUrl.pathname !== '/') url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|api|_next|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)'],
};
