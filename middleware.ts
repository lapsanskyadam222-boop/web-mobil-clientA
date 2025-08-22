import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE } from '@/lib/auth';

// Overenie JWT zo session cookie
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

  // Login stránka je verejná
  if (pathname.startsWith('/admin/login')) {
    return NextResponse.next();
  }

  // Overíme session pre chránené zóny
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySession(token);

  // Ak ide o API (save-content alebo blob) bez session → 401 JSON
  if (pathname.startsWith('/api/save-content') || pathname.startsWith('/api/blob')) {
    if (!ok) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.next();
  }

  // Ak ide o admin stránku bez session → presmeruj na login
  if (pathname.startsWith('/admin')) {
    if (!ok) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  return NextResponse.next();
}

/**
 * DÔLEŽITÉ: Middleware spúšťame len tam, kde ho naozaj potrebujeme.
 * Vôbec nespúšťame na /api/content (verejné API), takže SSR fetch nebude nikdy blokovaný.
 */
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/save-content/:path*',
    '/api/blob/:path*',
    // NESPUŠŤAŤ na /api/content !
  ],
};
