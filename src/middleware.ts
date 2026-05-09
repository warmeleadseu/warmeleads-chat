import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** CRM en klantportaal niet indexeren; voorkomt onbedoelde SEO naar inlogschermen. */
export function middleware(request: NextRequest) {
  void request.nextUrl.pathname;
  const res = NextResponse.next();
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/portal/:path*'],
};
