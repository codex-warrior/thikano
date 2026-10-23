import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { ownerContext, SESSION_COOKIE, verifySession, type OwnerSession } from '@thikano/server';
import { listProperties } from '@thikano/server/owner';

export const PROPERTY_COOKIE = 'thikano_pid';

/** Verified owner session for this request, or redirect to sign-in / onboarding. */
export const requireOwner = cache(async (): Promise<OwnerSession> => {
  const jar = await cookies();
  const decoded = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!decoded) redirect('/login');
  const ctx = await ownerContext(decoded);
  if (!ctx) redirect('/onboarding');
  return ctx;
});

/** The property the owner is working on (cookie), validated against their access. */
export const currentProperty = cache(async () => {
  const session = await requireOwner();
  const properties = await listProperties(session);
  const wanted = (await cookies()).get(PROPERTY_COOKIE)?.value;
  const property = properties.find((p) => p.id === wanted) ?? properties[0] ?? null;
  return { session, properties, property };
});

/** Pages that need a property; no property yet → setup. */
export async function requireProperty() {
  const ctx = await currentProperty();
  if (!ctx.property) redirect('/properties/new');
  return { ...ctx, property: ctx.property };
}
