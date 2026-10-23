'use server';

import { cookies } from 'next/headers';
import { PROPERTY_COOKIE, currentProperty } from '@/lib/session';

/** Remember which property the owner is working on (validated against their access). */
export async function selectProperty(propertyId: string) {
  const { properties } = await currentProperty();
  if (!properties.some((p) => p.id === propertyId)) return;
  (await cookies()).set(PROPERTY_COOKIE, propertyId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
}
