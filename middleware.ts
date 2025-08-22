// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'session';
const PROTECTED_PREFIXES = ['/admin', '/api/save-content', '/api/blob'];

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

  // púšťame len na chránené prefixy (matcher dole), tu len riešime autorizáciu
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySession(token);

  if (pathname.startsWith('/api')) {
    if (!ok) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.next();
  }

  if (!ok) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  return NextResponse.next();
}

// DÔLEŽITÉ: /api/content sem NEDÁVAJ
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/save-content',
    '/api/save-content/:path*',
    '/api/blob',
    '/api/blob/:path*',
  ],
};
