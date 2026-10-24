import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { onCall } from 'firebase-functions/v2/https';
import type { OrgMember, OrgRole, PlatformRole, StaffPermission, UserProfile } from '@thikano/domain';
import { auth, db, isEmulator, paths } from './lib/admin';
import { audit } from './lib/audit';
import { getMember, requireAuth, requireOwner, requirePlatformAdmin } from './lib/authz';
import { badInput, fail, notFound } from './lib/errors';
import { rateLimit } from './lib/rate-limit';
import { OTP_SECRETS, smsProvider } from './lib/sms';
import { autoLinkByEmail } from './residents';
import { id, indianPhone, obj, oneOf, optStr, str, strArray } from './lib/validate';

const STAFF_PERMISSIONS: readonly StaffPermission[] = [
  'inventory.read', 'inventory.write', 'residents.read', 'residents.write', 'rent.read', 'rent.collect',
  'maintenance.read', 'maintenance.write', 'notices.write', 'leads.read', 'leads.write', 'listings.publish', 'earnings.read',
];

// ───────────────────────── Profile ─────────────────────────

/**
 * Called by every app after sign-in. Creates users/{uid} on first login and
 * returns what the client needs to pick a surface: memberships (Owner), platform
 * role (Admin), and activeStay (mobile Resident vs Discover mode).
 */
export const ensureProfile = onCall(async (req) => {
  const caller = requireAuth(req);
  const ref = db.doc(`users/${caller.uid}`);
  const snap = await ref.get();
  let profile = snap.data() as UserProfile | undefined;
  if (!profile) {
    profile = {
      uid: caller.uid,
      displayName: caller.name ?? '',
      ...(caller.phone ? { phone: caller.phone } : {}),
      ...(caller.email ? { email: caller.email } : {}),
      activeStay: null,
      createdAt: Date.now(),
    };
    await ref.set(profile);
  }
  // Google sign-in: a stay waiting for this verified email is linked automatically.
  if (!caller.stay && !profile.activeStay) {
    const verified = (req.auth!.token as { email_verified?: boolean }).email_verified === true;
    if (await autoLinkByEmail(caller.uid, caller.email, verified)) profile = (await ref.get()).data() as UserProfile;
  }
  const memberships = await db.collectionGroup('members').where('uid', '==', caller.uid).where('status', '==', 'active').get();
  return {
    profile: { uid: profile.uid, displayName: profile.displayName, phone: profile.phone ?? null, email: profile.email ?? null, activeStay: profile.activeStay ?? null },
    platformRole: caller.platformRole,
    memberships: memberships.docs.map((d) => ({ orgId: d.ref.parent.parent!.id, role: (d.data() as OrgMember).role, propertyIds: (d.data() as OrgMember).propertyIds })),
  };
});

export const updateProfile = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const displayName = str(d, 'displayName', { min: 2, max: 60 });
  await db.doc(`users/${caller.uid}`).set({ displayName, updatedAt: Date.now() }, { merge: true });
  await auth.updateUser(caller.uid, { displayName });
  return { ok: true };
});

// ───────────────────────── Organizations & members ─────────────────────────

export const createOrganization = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const name = str(d, 'name', { min: 2, max: 80 });
  const ownerName = optStr(d, 'ownerName', 60) ?? caller.name ?? 'Owner';

  const existing = await db.collectionGroup('members').where('uid', '==', caller.uid).where('role', '==', 'owner').limit(1).get();
  if (!existing.empty) fail('already-exists', 'You already have a Habistat business account.');

  const orgRef = db.collection('organizations').doc();
  const t = Date.now();
  const batch = db.batch();
  batch.set(orgRef, { id: orgRef.id, name, ownerUid: caller.uid, verification: 'unverified', status: 'active', createdAt: t, updatedAt: t, createdBy: caller.uid });
  const member: OrgMember = { uid: caller.uid, role: 'owner', propertyIds: null, status: 'active', displayName: ownerName };
  batch.set(db.doc(paths.member(orgRef.id, caller.uid)), member);
  await audit({ actorUid: caller.uid, actorRole: 'owner', action: 'organization.created', entity: 'organization', entityId: orgRef.id, orgId: orgRef.id, metadata: { name } }, batch);
  await batch.commit();
  return { orgId: orgRef.id };
});

async function findOrCreateUser(phone: string | null, email: string | null, displayName: string) {
  try {
    return phone ? await auth.getUserByPhoneNumber(phone) : await auth.getUserByEmail(email!);
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
    return auth.createUser({ ...(phone ? { phoneNumber: phone } : { email: email! }), displayName });
  }
}

/** Owner adds a manager or staff member (with property scope + permissions). */
export const addMember = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  await requireOwner(caller, orgId, 'org.manage_members');
  const role = oneOf(d, 'role', ['manager', 'staff'] as const satisfies readonly OrgRole[]);
  const displayName = str(d, 'displayName', { min: 2, max: 60 });
  const phone = d.phone ? indianPhone(d) : null;
  const email = !phone ? str(d, 'email', { pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ }) : null;
  const propertyIds = Array.isArray(d.propertyIds) ? (d.propertyIds as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 50) : null;
  const permissions = role === 'staff' ? strArray(d, 'permissions', STAFF_PERMISSIONS) : undefined;

  if (propertyIds) {
    const props = await Promise.all(propertyIds.map((p) => db.doc(paths.property(orgId, p)).get()));
    if (props.some((s) => !s.exists)) badInput('One of the selected properties does not exist.');
  }
  const user = await findOrCreateUser(phone, email, displayName);
  const existing = await getMember(orgId, user.uid);
  if (existing?.role === 'owner') badInput('This person is the owner.');

  const member: OrgMember = { uid: user.uid, role, propertyIds, status: 'active', displayName, ...(permissions ? { permissions } : {}) };
  const batch = db.batch();
  batch.set(db.doc(paths.member(orgId, user.uid)), member);
  await audit({ actorUid: caller.uid, actorRole: 'owner', action: 'member.added', entity: 'member', entityId: user.uid, orgId, metadata: { role, propertyIds, permissions: permissions ?? null } }, batch);
  await batch.commit();
  return { uid: user.uid };
});

export const updateMember = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const uid = id(d, 'uid');
  await requireOwner(caller, orgId, 'org.manage_members');
  if (uid === caller.uid) badInput("You can't change your own owner access.");
  const current = await getMember(orgId, uid);
  if (!current) return notFound('team member');
  if (current.role === 'owner') badInput("The owner's access can't be changed.");

  const patch: Partial<OrgMember> = {};
  if (d.status != null) patch.status = oneOf(d, 'status', ['active', 'removed'] as const);
  if (d.role != null) patch.role = oneOf(d, 'role', ['manager', 'staff'] as const);
  if (d.permissions != null) patch.permissions = strArray(d, 'permissions', STAFF_PERMISSIONS);
  if (d.propertyIds !== undefined) patch.propertyIds = Array.isArray(d.propertyIds) ? (d.propertyIds as string[]).slice(0, 50) : null;

  const batch = db.batch();
  batch.update(db.doc(paths.member(orgId, uid)), patch);
  await audit({ actorUid: caller.uid, actorRole: 'owner', action: patch.status === 'removed' ? 'member.removed' : 'member.updated', entity: 'member', entityId: uid, orgId, metadata: patch as Record<string, unknown> }, batch);
  await batch.commit();
  return { ok: true };
});

// ───────────────────────── Platform roles ─────────────────────────

/** Platform admins grant/revoke platform roles. The first admin is bootstrapped by scripts/bootstrap-admin. */
export const setPlatformRole = onCall(async (req) => {
  const caller = requireAuth(req);
  requirePlatformAdmin(caller);
  const d = obj(req.data);
  // Accept a uid or the staff member's email address.
  const uid = d.uid ? id(d, 'uid') : (await auth.getUserByEmail(str(d, 'email', { pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ })).catch(() => notFound('user'))).uid;
  const role = d.role == null ? null : oneOf(d, 'role', ['platform_admin', 'platform_support'] as const satisfies readonly PlatformRole[]);
  if (uid === caller.uid && role !== 'platform_admin') badInput("You can't remove your own admin access.");
  const user = await auth.getUser(uid);
  const claims = { ...(user.customClaims ?? {}) } as Record<string, unknown>;
  if (role) claims.platformRole = role;
  else delete claims.platformRole;
  await auth.setCustomUserClaims(uid, claims);
  // platformStaff mirrors claims so functions can find admins to notify.
  if (role) await db.doc(`platformStaff/${uid}`).set({ uid, role, updatedAt: Date.now() });
  else await db.doc(`platformStaff/${uid}`).delete();
  await audit({ actorUid: caller.uid, actorRole: 'platform_admin', action: role ? 'platform.role_granted' : 'platform.role_revoked', entity: 'user', entityId: uid, metadata: { role } });
  return { ok: true };
});

// ───────────────────────── Phone OTP sign-in ─────────────────────────

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function otpSecret(): string {
  const s = process.env.OTP_HMAC_SECRET;
  if (s && s.length >= 32) return s;
  if (isEmulator()) return 'thikano-emulator-only-otp-secret-not-for-production';
  return fail('failed-precondition', 'Phone sign-in is not available yet. Please try again later.', { reason: 'OTP_HMAC_SECRET missing' });
}
const hashCode = (challengeId: string, code: string) => createHmac('sha256', otpSecret()).update(`${challengeId}:${code}`).digest();
const phoneKey = (phone: string) => createHash('sha256').update(phone).digest('hex');

export const requestOtp = onCall({ secrets: OTP_SECRETS }, async (req) => {
  const d = obj(req.data);
  const phone = indianPhone(d);
  const ip = req.rawRequest?.ip ?? 'unknown';
  await rateLimit(`otp:phone:${phone}`, 3, 15 * 60 * 1000, 'Too many codes requested. Please wait 15 minutes.');
  await rateLimit(`otp:ip:${ip}`, 20, 60 * 60 * 1000);

  const sms = smsProvider();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const ref = db.collection('otpChallenges').doc();
  await ref.set({ phoneHash: phoneKey(phone), phone, codeHash: hashCode(ref.id, code).toString('hex'), attempts: 0, expiresAt: Date.now() + OTP_TTL_MS, createdAt: Date.now() });
  await sms.sendOtp(phone, code);
  // The code is returned ONLY by the local emulator so automated tests can complete sign-in.
  return { challengeId: ref.id, ...(isEmulator() ? { devCode: code } : {}) };
});

export const verifyOtp = onCall({ secrets: OTP_SECRETS }, async (req) => {
  const d = obj(req.data);
  const challengeId = id(d, 'challengeId');
  const code = str(d, 'code', { pattern: /^\d{6}$/ });
  const ref = db.collection('otpChallenges').doc(challengeId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false as const, reason: 'expired' };
    const c = snap.data() as { phone: string; codeHash: string; attempts: number; expiresAt: number };
    if (Date.now() > c.expiresAt) {
      tx.delete(ref);
      return { ok: false as const, reason: 'expired' };
    }
    if (c.attempts >= OTP_MAX_ATTEMPTS) {
      tx.delete(ref);
      return { ok: false as const, reason: 'locked' };
    }
    const expected = Buffer.from(c.codeHash, 'hex');
    const given = hashCode(challengeId, code);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      tx.update(ref, { attempts: c.attempts + 1 });
      return { ok: false as const, reason: 'wrong' };
    }
    tx.delete(ref);
    return { ok: true as const, phone: c.phone };
  });

  if (!result.ok) {
    if (result.reason === 'wrong') fail('invalid-argument', "That code isn't right. Please check and try again.");
    fail('deadline-exceeded', 'This code has expired. Please request a new one.');
  }
  const user = await findOrCreateUser(result.phone, null, '');
  if (user.disabled) fail('permission-denied', 'This account has been disabled. Please contact Habistat support.');
  const token = await auth.createCustomToken(user.uid);
  return { token };
});

// ───────────────────────── Account deletion (Play Store + DPDP Act) ─────────────────────────

/**
 * Deletes the caller's Habistat account. Personal data is erased; records an owner is
 * legally required to keep (rent, payments) stay with the property but are unlinked from
 * the account. Active residents must complete move-out first; business owners close their
 * business through support (residents' records depend on it).
 */
export const deleteAccount = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  if (d.confirm !== 'DELETE') badInput('Please confirm account deletion.');
  if (caller.stay) fail('failed-precondition', 'You have an active stay. Ask your owner to complete your move-out, then delete your account.');
  const owned = await db.collectionGroup('members').where('uid', '==', caller.uid).where('role', '==', 'owner').limit(1).get();
  if (!owned.empty) fail('failed-precondition', 'You own a business on Habistat. Please contact Habistat support to close it.');

  const uid = caller.uid;
  const [memberships, residents, leads, devices, inbox] = await Promise.all([
    db.collectionGroup('members').where('uid', '==', uid).get(),
    db.collectionGroup('residents').where('uid', '==', uid).get(),
    db.collectionGroup('leads').where('studentUid', '==', uid).get(),
    db.collection(`users/${uid}/devices`).get(),
    db.collection(`users/${uid}/inbox`).get(),
  ]);
  const writes: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  for (const m of memberships.docs) writes.push((b) => b.update(m.ref, { status: 'removed', displayName: 'Deleted user' }));
  for (const r of residents.docs) writes.push((b) => b.update(r.ref, { uid: null, residentUid: null, phone: '', name: 'Former resident', updatedAt: Date.now() }));
  for (const l of leads.docs) writes.push((b) => b.update(l.ref, { studentUid: null, name: 'Deleted user', phone: '', message: '', updatedAt: Date.now() }));
  for (const x of [...devices.docs, ...inbox.docs]) writes.push((b) => b.delete(x.ref));
  writes.push((b) => b.delete(db.doc(`users/${uid}`)));
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach((w) => w(batch));
    await batch.commit();
  }
  await audit({ actorUid: uid, actorRole: roleOf(caller), action: 'account.deleted', entity: 'user', entityId: uid, metadata: { residentsUnlinked: residents.size, leadsAnonymised: leads.size } });
  await auth.deleteUser(uid);
  return { ok: true };
});

function roleOf(caller: { platformRole: string | null }) {
  return caller.platformRole ?? 'user';
}
