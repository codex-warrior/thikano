import { randomInt } from 'node:crypto';
import { formatINR, type Resident, type Room } from '@thikano/domain';
import { auth, db, paths } from './admin';
import { audit } from './audit';
import { fail } from './errors';
import { notifyUsers } from './notify';

/**
 * Linking a resident record (created by the owner) to a Habistat account.
 * Sign-in is Google-first, so we never create accounts on a resident's behalf. A resident
 * is linked when ANY of these match an existing account:
 *   1. the student who enquired/applied while signed in (booking.studentUid)
 *   2. a verified email the owner entered (auto-linked at the resident's first sign-in too)
 *   3. a phone-verified account with the same number
 * Otherwise the owner shares an 8-character invite code, redeemed in the app.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export const newInviteCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Set or clear the resident stay claim — merges with other claims (platformRole, …). */
export async function setStayClaim(uid: string, stay: { o: string; p: string; r: string } | null) {
  const user = await auth.getUser(uid);
  const claims = { ...(user.customClaims ?? {}) } as Record<string, unknown>;
  if (stay) claims.stay = stay;
  else delete claims.stay;
  await auth.setCustomUserClaims(uid, claims);
}

export async function findExistingUid(opts: { studentUid?: string | null; phone?: string | null; email?: string | null }): Promise<string | null> {
  const tryGet = async <T,>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/user-not-found') return null;
      throw e;
    }
  };
  if (opts.studentUid) {
    const u = await tryGet(() => auth.getUser(opts.studentUid!));
    if (u && !u.disabled) return u.uid;
  }
  if (opts.email) {
    const u = await tryGet(() => auth.getUserByEmail(opts.email!));
    // Only verified emails (Google accounts are) — an unverified signup must not capture a stay.
    if (u && u.emailVerified && !u.disabled) return u.uid;
  }
  if (opts.phone) {
    const u = await tryGet(() => auth.getUserByPhoneNumber(opts.phone!));
    if (u && !u.disabled) return u.uid;
  }
  return null;
}

export async function hasActiveStay(uid: string): Promise<boolean> {
  const s = await db.collectionGroup('residents').where('uid', '==', uid).where('status', 'in', ['active', 'notice']).limit(1).get();
  return !s.empty;
}

/**
 * Attach an unlinked resident to an account: resident + their invoices/orders get the uid,
 * the user gets activeStay + the stay claim (the app switches to Resident mode).
 */
export async function linkResident(orgId: string, residentId: string, uid: string, actor: { uid: string; role: string }): Promise<{ propertyId: string }> {
  if (await hasActiveStay(uid)) fail('failed-precondition', 'This account already has an active stay on Habistat.');
  const resRef = db.doc(`${paths.orgCol(orgId, 'residents')}/${residentId}`);
  const res = await db.runTransaction(async (tx) => {
    const r = (await tx.get(resRef)).data() as (Resident & { inviteCode?: string | null }) | undefined;
    if (!r || !['active', 'notice'].includes(r.status)) return fail('not-found', "We couldn't find that stay.");
    if (r.uid && r.uid !== uid) return fail('failed-precondition', 'This stay is already linked to another account.');
    tx.update(resRef, { uid, residentUid: uid, inviteCode: null, updatedAt: Date.now() });
    if (r.inviteCode) tx.delete(db.doc(`residentInvites/${r.inviteCode}`));
    tx.set(db.doc(`users/${uid}`), { uid, activeStay: { orgId, propertyId: r.propertyId, residentId } }, { merge: true });
    await audit({ actorUid: actor.uid, actorRole: actor.role, action: 'resident.account_linked', entity: 'resident', entityId: residentId, orgId, metadata: { uid } }, tx);
    return r;
  });
  // Records created before linking carry residentUid: null — attach them so rules let the resident read them.
  const [invoices, issues] = await Promise.all([
    db.collection(paths.orgCol(orgId, 'invoices')).where('residentId', '==', residentId).get(),
    db.collection(paths.orgCol(orgId, 'maintenance')).where('residentId', '==', residentId).get(),
  ]);
  const batch = db.batch();
  for (const d of [...invoices.docs, ...issues.docs]) batch.update(d.ref, { residentUid: uid });
  await batch.commit();
  await setStayClaim(uid, { o: orgId, p: res.propertyId, r: residentId });
  const room = (await db.doc(paths.room(orgId, res.propertyId, res.roomId)).get()).data() as Room | undefined;
  await notifyUsers([uid], { kind: 'system', title: 'Welcome home 🏠', body: `You're all set${room ? ` in Room ${room.number}` : ''}. Rent ${formatINR(res.rent)}/month.`, link: 'habistat://home' });
  return { propertyId: res.propertyId };
}

/** Create a redeemable invite for an unlinked resident (30 days). */
export async function issueInvite(orgId: string, propertyId: string, residentId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode();
    const ref = db.doc(`residentInvites/${code}`);
    const ok = await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return false;
      tx.set(ref, { orgId, propertyId, residentId, createdAt: Date.now(), expiresAt: Date.now() + 30 * 86_400_000 });
      tx.update(db.doc(`${paths.orgCol(orgId, 'residents')}/${residentId}`), { inviteCode: code });
      return true;
    });
    if (ok) return code;
  }
  throw new Error('Could not allocate invite code');
}
