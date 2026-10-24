import { onCall } from 'firebase-functions/v2/https';
import { formatINR, haversineKm, summarizeProperty, type Bed, type Property, type PropertyVerificationStatus, type Room, type SharingType } from '@thikano/domain';
import { db, paths } from './lib/admin';
import { audit } from './lib/audit';
import { requireAuth, requirePermission, requirePlatformAdmin } from './lib/authz';
import { badInput, fail, notFound } from './lib/errors';
import { notifyOrg } from './lib/notify';
import { id, obj, oneOf, optStr, str } from './lib/validate';

// ───────────────────────── Property verification (Admin) ─────────────────────────

/** Approve / request changes / reject. Approval makes listed rooms public via projection triggers. */
export const reviewProperty = onCall(async (req) => {
  const caller = requireAuth(req);
  requirePlatformAdmin(caller);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const propertyId = id(d, 'propertyId');
  const decision = oneOf(d, 'decision', ['approve', 'request_changes', 'reject'] as const);
  const notes = optStr(d, 'notes', 1000);
  if (decision !== 'approve' && !notes) badInput('Please tell the owner what needs to change.');
  const ref = db.doc(paths.property(orgId, propertyId));
  const snap = await ref.get();
  if (!snap.exists) return notFound('property');
  const p = snap.data() as Property;
  if (p.verification !== 'submitted') fail('failed-precondition', 'This property is not waiting for review.');
  const next: PropertyVerificationStatus = decision === 'approve' ? 'verified' : decision === 'reject' ? 'rejected' : 'changes_requested';
  const t = Date.now();
  const batch = db.batch();
  batch.update(ref, { verification: next, updatedAt: t });
  batch.set(db.doc(`verificationRequests/${propertyId}`), { status: next, reviewedBy: caller.uid, reviewedAt: t, notes }, { merge: true });
  if (decision === 'approve') batch.set(db.doc(paths.org(orgId)), { verification: 'verified' }, { merge: true });
  await audit({ actorUid: caller.uid, actorRole: 'platform_admin', action: `property.${next}`, entity: 'property', entityId: propertyId, orgId, metadata: { notes } }, batch);
  await batch.commit();
  await notifyOrg(orgId, propertyId, 'inventory.read', {
    kind: 'verification',
    title: decision === 'approve' ? `${p.name} is verified ✓` : decision === 'reject' ? `${p.name} was not approved` : `${p.name}: changes requested`,
    body: decision === 'approve' ? 'Listed rooms are now visible to students on Habistat.' : notes!,
    link: '/properties',
  });
  return { verification: next };
});

/** Suspend or reinstate a whole property (all listings disappear / return). */
export const setPropertySuspended = onCall(async (req) => {
  const caller = requireAuth(req);
  requirePlatformAdmin(caller);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const propertyId = id(d, 'propertyId');
  const suspended = d.suspended === true;
  const reason = str(d, 'reason', { min: 3, max: 500 });
  const ref = db.doc(paths.property(orgId, propertyId));
  const p = (await ref.get()).data() as Property | undefined;
  if (!p) return notFound('property');
  if (suspended && p.verification === 'suspended') return { verification: 'suspended' };
  if (!suspended && p.verification !== 'suspended') badInput('This property is not suspended.');
  const next: PropertyVerificationStatus = suspended ? 'suspended' : 'verified';
  const batch = db.batch();
  batch.update(ref, { verification: next, updatedAt: Date.now() });
  await audit({ actorUid: caller.uid, actorRole: 'platform_admin', action: suspended ? 'property.suspended' : 'property.reinstated', entity: 'property', entityId: propertyId, orgId, metadata: { reason } }, batch);
  await batch.commit();
  return { verification: next };
});

/** Moderate a single listing without touching the owner's intent. */
export const setRoomSuspended = onCall(async (req) => {
  const caller = requireAuth(req);
  requirePlatformAdmin(caller);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const propertyId = id(d, 'propertyId');
  const roomId = id(d, 'roomId');
  const suspended = d.suspended === true;
  const reason = str(d, 'reason', { min: 3, max: 500 });
  const ref = db.doc(paths.room(orgId, propertyId, roomId));
  if (!(await ref.get()).exists) return notFound('room');
  const batch = db.batch();
  batch.update(ref, { adminSuspended: suspended, updatedAt: Date.now() });
  await audit({ actorUid: caller.uid, actorRole: 'platform_admin', action: suspended ? 'listing.suspended' : 'listing.reinstated', entity: 'room', entityId: roomId, orgId, metadata: { propertyId, reason } }, batch);
  await batch.commit();
  return { ok: true };
});

// ───────────────────────── Owner insights (deterministic, no AI) ─────────────────────────

/**
 * Vacancy + demand intelligence: what vacant beds cost per month, and how many recent
 * student searches near this property match its rooms by budget and sharing.
 */
export const getPropertyInsights = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const propertyId = id(d, 'propertyId');
  await requirePermission(caller, orgId, 'inventory.read', propertyId);
  const p = (await db.doc(paths.property(orgId, propertyId)).get()).data() as Property | undefined;
  if (!p) return notFound('property');
  const [roomsSnap, bedsSnap] = await Promise.all([db.collection(paths.rooms(orgId, propertyId)).get(), db.collection(paths.beds(orgId, propertyId)).get()]);
  const beds = bedsSnap.docs.map((s) => s.data() as Bed);
  const rooms = roomsSnap.docs.map((s) => s.data() as Room);
  const summary = summarizeProperty(rooms.map((r) => ({ rent: r.rent, operationalStatus: r.operationalStatus, beds: beds.filter((b) => b.roomId === r.id) })));

  const since = Date.now() - 30 * 86_400_000;
  const searches = await db.collection('searchEvents').where('at', '>=', since).orderBy('at', 'desc').limit(2000).get();
  const RADIUS_KM = 3;
  const vacantRooms = rooms.filter((r) => r.inventory?.availableBeds > 0);
  let nearby = 0;
  let matching = 0;
  const sessions = new Set<string>();
  for (const s of searches.docs) {
    const e = s.data() as { lat: number | null; lng: number | null; maxRent: number | null; sharing: SharingType | null; sessionId: string | null; area: string | null; college: string | null };
    const near =
      (e.lat != null && e.lng != null && haversineKm(p.location, { lat: e.lat, lng: e.lng }) <= RADIUS_KM) ||
      (e.area != null && e.area.toLowerCase() === p.address.locality.toLowerCase()) ||
      (e.college != null && p.nearbyColleges.some((c) => c.toLowerCase().includes(e.college!.toLowerCase())));
    if (!near) continue;
    const key = e.sessionId ?? s.id;
    if (sessions.has(key)) continue;
    sessions.add(key);
    nearby++;
    if (vacantRooms.some((r) => (e.maxRent == null || r.rent <= e.maxRent) && (e.sharing == null || r.sharing === e.sharing))) matching++;
  }
  const level = nearby >= 25 ? 'high' : nearby >= 8 ? 'medium' : 'low';
  const unlistedVacant = vacantRooms.filter((r) => r.listingIntent === 'unlisted').sort((a, b) => b.inventory.availableBeds * b.rent - a.inventory.availableBeds * a.rent);
  const recommendation = unlistedVacant[0]
    ? `List Room ${unlistedVacant[0].number} — ${unlistedVacant[0].inventory.availableBeds} bed${unlistedVacant[0].inventory.availableBeds === 1 ? '' : 's'} empty (${formatINR(unlistedVacant[0].rent * unlistedVacant[0].inventory.availableBeds)}/month).`
    : summary.availableBeds > 0
      ? 'All vacant rooms are listed. Share your property link in college groups.'
      : 'Fully occupied — nothing to do.';
  return {
    vacantBeds: summary.availableBeds,
    lostMonthlyRevenue: summary.vacantRevenue,
    upcomingVacancies: summary.upcomingVacancies,
    occupancyRate: summary.occupancyRate,
    demand: { studentsSearchingNearby: nearby, matchingYourRooms: matching, level, windowDays: 30, radiusKm: RADIUS_KM },
    recommendation,
  };
});
