import type { CallableRequest } from 'firebase-functions/v2/https';
import { can, canOwnerOnly, type OrgMember, type OwnerOnlyAction, type PlatformRole, type StaffPermission } from '@thikano/domain';
import { db, paths } from './admin';
import { fail, notAllowed } from './errors';

export interface Caller {
  uid: string;
  platformRole: PlatformRole | null;
  stay: { o: string; p: string; r: string } | null;
  phone: string | null;
  email: string | null;
  name: string | null;
}

export function requireAuth(req: CallableRequest<unknown>): Caller {
  if (!req.auth) fail('unauthenticated', 'Please sign in to continue.');
  const t = req.auth.token as Record<string, unknown>;
  return {
    uid: req.auth.uid,
    platformRole: (t.platformRole as PlatformRole | undefined) ?? null,
    stay: (t.stay as Caller['stay'] | undefined) ?? null,
    phone: (t.phone_number as string | undefined) ?? null,
    email: (t.email as string | undefined) ?? null,
    name: (t.name as string | undefined) ?? null,
  };
}

export async function getMember(orgId: string, uid: string): Promise<OrgMember | null> {
  const snap = await db.doc(paths.member(orgId, uid)).get();
  return snap.exists ? (snap.data() as OrgMember) : null;
}

/** Server-side mirror of firestore.rules `can()` — uses the same domain matrix. */
export async function requirePermission(caller: Caller, orgId: string, permission: StaffPermission, propertyId?: string): Promise<OrgMember> {
  const member = await getMember(orgId, caller.uid);
  if (!can(member, permission, propertyId)) notAllowed();
  return member!;
}

export async function requireOwner(caller: Caller, orgId: string, action: OwnerOnlyAction): Promise<OrgMember> {
  const member = await getMember(orgId, caller.uid);
  if (!canOwnerOnly(member, action)) notAllowed();
  return member!;
}

export function requirePlatformAdmin(caller: Caller): void {
  if (caller.platformRole !== 'platform_admin') notAllowed();
}

export function requirePlatformStaff(caller: Caller): void {
  if (caller.platformRole !== 'platform_admin' && caller.platformRole !== 'platform_support') notAllowed();
}

export function roleLabel(caller: Caller, member?: OrgMember | null): string {
  return caller.platformRole ?? member?.role ?? (caller.stay ? 'resident' : 'student');
}
