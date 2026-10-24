import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { platformContext, SESSION_COOKIE, verifySession, type PlatformSession } from '@thikano/server';

/** Verified Habistat staff session (platform role claim), or redirect. */
export const requirePlatform = cache(async (): Promise<PlatformSession> => {
  const decoded = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!decoded) redirect('/login');
  const s = platformContext(decoded);
  if (!s) redirect('/login?denied=1');
  return s;
});

export async function requireAdmin(): Promise<PlatformSession> {
  const s = await requirePlatform();
  if (s.role !== 'platform_admin') redirect('/?denied=economics');
  return s;
}
