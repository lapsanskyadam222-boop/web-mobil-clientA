// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'session'; // ak to máš v lib/auth, pokojne importuj odtiaľ

// Ktoré prefixy sú CHRÁNENÉ (vyžadujú login)
const PROTECTED_PREFIXES = ['/admin', '/api/save-content', '/api/blob'];

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

  // Ak nie je chránená cesta, middleware nič nerieši
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // Over login
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySession(token);

  // API -> vráť 401 JSON
  if (pathname.startsWith('/api')) {
    if (!ok) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.next();
  }

  // Stránky -> presmeruj na login
  if (!ok) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  return NextResponse.next();
}

// DÔLEŽITÉ: middleware púšťame LEN na chránené cesty
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/save-content',
    '/api/save-content/:path*',
    '/api/blob',
    '/api/blob/:path*',
  ],
};
