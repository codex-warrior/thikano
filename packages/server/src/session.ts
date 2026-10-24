import './app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { OrgMember, PlatformRole } from '@thikano/domain';

/**
 * Server sessions: the browser signs in with Firebase Auth, posts its ID token once,
 * and receives an httpOnly session cookie (createSessionCookie). Every server render
 * re-verifies it (including revocation) — UI routing is never the security boundary.
 */
export const SESSION_COOKIE = '__session';
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export async function createSession(idToken: string): Promise<string> {
  const auth = getAuth();
  const decoded = await auth.verifyIdToken(idToken, true);
  // Require a recent sign-in to mint a session.
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) throw new Error('recent-login-required');
  return auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
}

export async function verifySession(cookie: string | undefined): Promise<DecodedIdToken | null> {
  if (!cookie) return null;
  try {
    return await getAuth().verifySessionCookie(cookie, true);
  } catch {
    return null;
  }
}

export async function revokeSession(cookie: string | undefined): Promise<void> {
  const decoded = await verifySession(cookie);
  if (decoded) await getAuth().revokeRefreshTokens(decoded.sub);
}

export interface OwnerSession {
  uid: string;
  name: string;
  email: string | null;
  orgId: string;
  orgName: string;
  member: OrgMember;
}

/** Resolve the owner-console context: the signed-in user's active org membership. */
export async function ownerContext(decoded: DecodedIdToken | null): Promise<OwnerSession | null> {
  if (!decoded) return null;
  const db = getFirestore();
  const memberships = await db.collectionGroup('members').where('uid', '==', decoded.uid).where('status', '==', 'active').limit(5).get();
  if (memberships.empty) return null;
  // Prefer the org the user owns; otherwise the first membership.
  const pick = memberships.docs.find((d) => d.get('role') === 'owner') ?? memberships.docs[0]!;
  const orgId = pick.ref.parent.parent!.id;
  const org = await db.doc(`organizations/${orgId}`).get();
  const member = pick.data() as OrgMember;
  return { uid: decoded.uid, name: member.displayName || (decoded.name as string) || 'Owner', email: decoded.email ?? null, orgId, orgName: (org.get('name') as string) ?? '', member };
}

export interface PlatformSession {
  uid: string;
  name: string;
  role: PlatformRole;
}

export function platformContext(decoded: DecodedIdToken | null): PlatformSession | null {
  const role = decoded?.platformRole as PlatformRole | undefined;
  if (!decoded || (role !== 'platform_admin' && role !== 'platform_support')) return null;
  return { uid: decoded.uid, name: (decoded.name as string) ?? decoded.email ?? 'Habistat staff', role };
}
