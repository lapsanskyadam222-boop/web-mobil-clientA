// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE } from '@/lib/auth';

// --- Helper: verify session JWT ---
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

  // --- TVRDÁ POISTKA: verejné čítacie API nikdy neblokuj ---
  if (pathname === '/api/content' || pathname.startsWith('/api/content/')) {
    return NextResponse.next();
  }

  // Login je verejný
  if (pathname.startsWith('/admin/login')) {
    return NextResponse.next();
  }

  // Chránené API: /api/save-content a /api/blob
  if (
    pathname === '/api/save-content' ||
    pathname.startsWith('/api/save-content/') ||
    pathname === '/api/blob' ||
    pathname.startsWith('/api/blob/')
  ) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const ok = await verifySession(token);
    if (!ok) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.next();
  }

  // Admin stránka bez session → redirect na login
  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const ok = await verifySession(token);
    if (!ok) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  return NextResponse.next();
}

// Matcher spúšťa middleware len tam, kde treba.
// (Na /api/content sa nespustí vôbec.)
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/save-content/:path*',
    '/api/blob/:path*',
    // zámerne NIK nie /api/content
  ],
};
