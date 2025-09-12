// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'session';

// cesty, ktoré majú byť chránené (stránky aj API)
const PROTECTED_PAGES = ['/admin'];              // /admin + podstránky
const PROTECTED_API   = ['/api/save-content', '/api/blob']; // server akcie pre admina

async function verifySession(token?: string) {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Verejné výnimky – nechaj prejsť:
  // - login stránka a login API, inak by vznikla slučka
  if (pathname.startsWith('/admin/login') || pathname.startsWith('/api/auth/login')) {
    return NextResponse.next();
  }
  // - verejné API a statiky
  if (
    pathname.startsWith('/api/content') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|txt|json)$/)
  ) {
    return NextResponse.next();
  }

  // 2) Je to chránená PAGE?
  const isProtectedPage = PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'));
  // 3) Je to chránené API?
  const isProtectedApi = PROTECTED_API.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySession(token);

  if (isProtectedApi) {
    // API → vráť 401 ak nie je prihlásený
    if (!ok) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.next();
  }

  // Stránky
  if (!ok) {
    // nie je prihlásený → presmeruj na login
    const url = new URL('/admin/login', req.url);
    url.searchParams.set('next', pathname); // po logine vieš vrátiť späť
    return NextResponse.redirect(url);
  }

  // ak je prihlásený a ide na /admin/login → pošli ho na /admin
  if (pathname === '/admin/login') {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}

/**
 * DÔLEŽITÉ: pridávam explicitne aj '/admin' (nie len '/admin/:path*'),
 * pretože niektoré kombinácie Next/middleware to bez toho nezachytia.
 */
export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/api/save-content',
    '/api/save-content/:path*',
    '/api/blob',
    '/api/blob/:path*',
  ],
};
