import { NextResponse, type NextRequest } from 'next/server';
import { createSession, revokeSession, SESSION_COOKIE, SESSION_MAX_AGE_MS } from '@thikano/server';

/** POST { idToken } → httpOnly session cookie. DELETE → sign out (revokes refresh tokens). */
export async function POST(req: NextRequest) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: 'Please sign in again.' }, { status: 400 });
  try {
    const cookie = await createSession(idToken);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE_MS / 1000 });
    return res;
  } catch (e) {
    console.error('session create failed', e);
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  await revokeSession(req.cookies.get(SESSION_COOKIE)?.value).catch(() => undefined);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
