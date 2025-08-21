import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE } from '@/lib/auth';

const PROTECTED_PREFIXES = ['/admin', '/api/save-content', '/api/blob'];

/**
 * Helper: overí JWT zo session cookie.
 */
async function verifySession(token: string | undefined) {
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

  // Verejné API: čítanie obsahu je public
  if (pathname.startsWith('/api/content')) {
    return NextResponse.next();
  }

  // Pustíme login stránky a login API
  if (pathname.startsWith('/admin/login') || pathname.startsWith('/api/auth/login')) {
    return NextResponse.next();
  }

  // Zistíme, či je cesta chránená
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // Overíme session
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySession(token);

  // Pre API endpointy vrátime 401 JSON namiesto redirectu
  if (pathname.startsWith('/api')) {
    if (!ok) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return NextResponse.next();
  }

  // Pre stránky (napr. /admin) urobíme redirect na /admin/login
  if (!ok) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*']
};
