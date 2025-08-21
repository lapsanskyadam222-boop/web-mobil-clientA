import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { signSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Chýba email/heslo' }, { status: 400 });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const hash = process.env.ADMIN_PASSWORD_HASH;
    const secretSet = !!process.env.AUTH_SECRET;

    if (!adminEmail || !hash || !secretSet) {
      return NextResponse.json({ error: 'Server nie je nakonfigurovaný (env vars)' }, { status: 500 });
    }

    const okEmail = email === adminEmail;
    const okPass = await bcrypt.compare(password, hash);

    if (!okEmail || !okPass) {
      return NextResponse.json({ error: 'Zlé prihlasovacie údaje' }, { status: 401 });
    }

    const token = await signSession(email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: 'session',
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Neplatná požiadavka' }, { status: 400 });
  }
}
