// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// cookie názov máš už inde zadefinovaný – ak chceš, nechaj si ho tu napevno:
const SESSION_COOKIE = 'session';

const PROTECTED_PREFIXES = ['/admin', '/api/save-content', '/api/blob'];

// Overenie JWT zo session cookie
async function verifySession(token?: string) {
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login stránky a login API vždy povoliť
  if (pathname.startsWith('/admin/login') || pathname.startsWith('/api/auth/login')) {
    return NextResponse.next();
  }

  // Verejný obsah – /api/content nikdy nechráň
  if (pathname.startsWith('/api/content')) {
    return NextResponse.next();
  }

  // Zistíme, či je cesta chránená
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // Overíme session iba pre chránené cesty
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySession(token);

  // API: vráť 401 JSON
  if (pathname.startsWith('/api')) {
    if (!ok) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.next();
  }

  // Stránky (/admin): presmeruj na login
  if (!ok) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  return NextResponse.next();
}

// DÔLEŽITÉ: matcher len na chránené cesty.
// /api/content sem úmyselne nedávame.
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/save-content',
    '/api/save-content/:path*',
    '/api/blob/:path*',
  ],
};
