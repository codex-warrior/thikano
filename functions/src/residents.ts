import { onCall } from 'firebase-functions/v2/https';
import type { Resident } from '@thikano/domain';
import { db, paths } from './lib/admin';
import { audit } from './lib/audit';
import { requireAuth, requirePermission, roleLabel } from './lib/authz';
import { fail, notFound } from './lib/errors';
import { rateLimit } from './lib/rate-limit';
import { issueInvite, linkResident, normalizeCode } from './lib/stay';
import { id, obj, str } from './lib/validate';

/** Resident redeems the invite code their owner shared → the app switches to Resident mode. */
export const claimResidentInvite = onCall(async (req) => {
  const caller = requireAuth(req);
  await rateLimit(`invite:${caller.uid}`, 10, 60 * 60 * 1000, 'Too many attempts. Please try again in an hour.');
  const code = normalizeCode(str(obj(req.data), 'code', { min: 6, max: 16 }));
  const snap = await db.doc(`residentInvites/${code}`).get();
  const inv = snap.data() as { orgId: string; propertyId: string; residentId: string; expiresAt: number } | undefined;
  if (!inv || inv.expiresAt < Date.now()) fail('not-found', "That code isn't valid. Please check it with your PG.");
  await linkResident(inv!.orgId, inv!.residentId, caller.uid, { uid: caller.uid, role: 'resident' });
  return { ok: true };
});

/** Owner issues a fresh invite code for a resident whose app is not linked yet. */
export const refreshResidentInvite = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const residentId = id(d, 'residentId');
  const ref = db.doc(`${paths.orgCol(orgId, 'residents')}/${residentId}`);
  const res = (await ref.get()).data() as (Resident & { inviteCode?: string | null }) | undefined;
  if (!res) return notFound('resident');
  const member = await requirePermission(caller, orgId, 'residents.write', res.propertyId);
  if (res.uid) fail('failed-precondition', 'This resident is already using the app.');
  if (res.inviteCode) await db.doc(`residentInvites/${res.inviteCode}`).delete();
  const code = await issueInvite(orgId, res.propertyId, residentId);
  await audit({ actorUid: caller.uid, actorRole: roleLabel(caller, member), action: 'resident.invite_issued', entity: 'resident', entityId: residentId, orgId });
  return { inviteCode: code };
});

/**
 * Auto-link at sign-in: a pending resident record whose owner-entered email matches the
 * caller's VERIFIED email (Google sign-in) is linked without any code.
 */
export async function autoLinkByEmail(uid: string, email: string | null, emailVerified: boolean): Promise<boolean> {
  if (!email || !emailVerified) return false;
  const pending = await db.collectionGroup('residents').where('email', '==', email.toLowerCase()).where('uid', '==', null).limit(2).get();
  const active = pending.docs.filter((d) => ['active', 'notice'].includes((d.data() as Resident).status));
  if (active.length !== 1) return false; // ambiguous or none → invite code path
  const r = active[0]!.data() as Resident;
  await linkResident(r.orgId, r.id, uid, { uid, role: 'resident' });
  return true;
}
