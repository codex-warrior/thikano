import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import {
  deriveListingStatus,
  deriveRoomInventory,
  isEligibleForOneClickListing,
  projectPublicProperty,
  projectPublicRoom,
  propertySlug,
  roomSlug,
  withSuffix,
  type Bed,
  type ListingIntent,
  type Property,
  type PublicRoom,
  type Room,
  type RoomInventory,
} from '@thikano/domain';
import { db, paths } from './lib/admin';
import { audit } from './lib/audit';
import { requireAuth, requireOwner, requirePermission, roleLabel } from './lib/authz';
import { badInput, fail, notFound } from './lib/errors';
import { id, obj, oneOf } from './lib/validate';

/**
 * INVENTORY ENGINE
 *  beds (source of truth) ──onBedWritten──▶ rooms.inventory (cache)
 *  rooms / properties ──onRoomWritten / onPropertyWritten──▶ slugs + publicRooms + publicProperties
 * Every derived value is computed by @thikano/domain.
 */

const sameJSON = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ───────────── slugs ─────────────

/** Reserve a globally unique slug (slugs/{slug}) for a property or room; idempotent per entity. */
async function reserveSlug(base: string, kind: 'property' | 'room', entity: { id: string; orgId: string; propertyId: string }): Promise<string> {
  for (let n = 1; n < 50; n++) {
    const slug = withSuffix(base || kind, n);
    const ref = db.doc(`slugs/${slug}`);
    const ok = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return snap.data()!.id === entity.id;
      tx.set(ref, { kind, id: entity.id, orgId: entity.orgId, propertyId: entity.propertyId, createdAt: Date.now() });
      return true;
    });
    if (ok) return slug;
  }
  throw new Error(`Could not allocate slug for ${base}`);
}

// ───────────── room inventory ─────────────

export async function recomputeRoomInventory(orgId: string, propertyId: string, roomId: string): Promise<RoomInventory | null> {
  const roomRef = db.doc(paths.room(orgId, propertyId, roomId));
  return db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) return null;
    const room = roomSnap.data() as Room;
    const beds = await tx.get(db.collection(paths.beds(orgId, propertyId)).where('roomId', '==', roomId));
    const inventory = deriveRoomInventory(beds.docs.map((d) => d.data() as Bed), room.rent);
    if (!sameJSON(room.inventory, inventory)) tx.update(roomRef, { inventory });
    return inventory;
  });
}

export const onBedWritten = onDocumentWritten('organizations/{orgId}/properties/{propertyId}/beds/{bedId}', async (event) => {
  const { orgId, propertyId } = event.params;
  const before = event.data?.before.data() as Bed | undefined;
  const after = event.data?.after.data() as Bed | undefined;
  const roomIds = new Set([before?.roomId, after?.roomId].filter((x): x is string => !!x));
  for (const roomId of roomIds) await recomputeRoomInventory(orgId, propertyId, roomId);
});

// ───────────── public projections ─────────────

async function ratingFor(propertyId: string) {
  const snap = await db.doc(`ratings/${propertyId}`).get();
  const d = snap.data() as { rating?: number; count?: number } | undefined;
  return { rating: d?.rating ?? null, ratingCount: d?.count ?? 0 };
}

export async function syncPublicRoom(property: Property, room: Room): Promise<PublicRoom | null> {
  const ref = db.doc(`publicRooms/${room.id}`);
  const suspended = (room as Room & { adminSuspended?: boolean }).adminSuspended === true;
  const projected = projectPublicRoom(property, room, await ratingFor(property.id), suspended);
  if (projected) await ref.set(projected);
  else await ref.delete();
  return projected;
}

export async function syncPublicProperty(orgId: string, propertyId: string): Promise<void> {
  const snap = await db.doc(paths.property(orgId, propertyId)).get();
  const ref = db.doc(`publicProperties/${propertyId}`);
  if (!snap.exists) return void (await ref.delete());
  const property = snap.data() as Property;
  const rooms = await db.collection('publicRooms').where('propertyId', '==', propertyId).get();
  const projected = projectPublicProperty(property, rooms.docs.map((d) => d.data() as PublicRoom), await ratingFor(propertyId));
  if (projected) await ref.set(projected);
  else await ref.delete();
}

export const onRoomWritten = onDocumentWritten('organizations/{orgId}/properties/{propertyId}/rooms/{roomId}', async (event) => {
  const { orgId, propertyId, roomId } = event.params;
  const after = event.data?.after;
  if (!after?.exists) {
    await db.doc(`publicRooms/${roomId}`).delete();
    await syncPublicProperty(orgId, propertyId);
    return;
  }
  const room = after.data() as Room;
  const propSnap = await db.doc(paths.property(orgId, propertyId)).get();
  if (!propSnap.exists) return;
  const property = propSnap.data() as Property;

  // Server-managed defaults for a freshly created room. Writing them retriggers this function.
  const patch: Partial<Room> = {};
  if (!room.publicSlug) patch.publicSlug = await reserveSlug(roomSlug(property.name, room.number), 'room', { id: roomId, orgId, propertyId });
  if (!room.inventory) patch.inventory = deriveRoomInventory([], room.rent);
  if (!room.stats) patch.stats = { views: 0, shares: 0, enquiries: 0, applications: 0, bookings: 0 };
  if (Object.keys(patch).length) {
    await after.ref.update(patch);
    return;
  }
  // Rent change must refresh minRent in the cache.
  const before = event.data?.before.data() as Room | undefined;
  if (before && before.rent !== room.rent) {
    await recomputeRoomInventory(orgId, propertyId, roomId);
    return;
  }
  await syncPublicRoom(property, room);
  await syncPublicProperty(orgId, propertyId);
});

const PUBLIC_PROPERTY_FIELDS: (keyof Property)[] = ['name', 'slug', 'kind', 'genderRule', 'description', 'address', 'location', 'nearbyColleges', 'amenities', 'rules', 'photos', 'videos', 'foodIncluded', 'verification', 'publicContactPhone'];

export const onPropertyWritten = onDocumentWritten('organizations/{orgId}/properties/{propertyId}', async (event) => {
  const { orgId, propertyId } = event.params;
  const after = event.data?.after;
  if (!after?.exists) return void (await db.doc(`publicProperties/${propertyId}`).delete());
  const property = after.data() as Property;
  if (!property.slug) {
    const slug = await reserveSlug(propertySlug(property.name, property.address?.locality ?? ''), 'property', { id: propertyId, orgId, propertyId });
    await after.ref.update({ slug });
    return;
  }
  const before = event.data?.before.data() as Property | undefined;
  const relevant = !before || PUBLIC_PROPERTY_FIELDS.some((k) => !sameJSON(before[k], property[k]));
  if (!relevant) return;
  // Property-level change (verification, amenities, name…) affects every room projection.
  const rooms = await db.collection(paths.rooms(orgId, propertyId)).get();
  for (const r of rooms.docs) await syncPublicRoom(property, r.data() as Room);
  await syncPublicProperty(orgId, propertyId);
  logger.info('property projection synced', { propertyId, rooms: rooms.size });
});

// ───────────── listing callables (audited) ─────────────

export const setRoomListing = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const propertyId = id(d, 'propertyId');
  const roomId = id(d, 'roomId');
  const intent = oneOf(d, 'intent', ['listed', 'unlisted', 'paused', 'archived'] as const satisfies readonly ListingIntent[]);
  const member = await requirePermission(caller, orgId, 'listings.publish', propertyId);

  const [propSnap, roomSnap] = await Promise.all([db.doc(paths.property(orgId, propertyId)).get(), db.doc(paths.room(orgId, propertyId, roomId)).get()]);
  if (!propSnap.exists || !roomSnap.exists) return notFound('room');
  const property = propSnap.data() as Property;
  const room = roomSnap.data() as Room;
  if (intent === 'listed' && (property.verification === 'rejected' || property.verification === 'suspended')) {
    fail('failed-precondition', 'This property cannot be listed right now. Please contact Habistat support.');
  }
  const batch = db.batch();
  batch.update(roomSnap.ref, { listingIntent: intent, updatedAt: Date.now() });
  await audit({ actorUid: caller.uid, actorRole: roleLabel(caller, member), action: intent === 'listed' ? 'room.published' : `room.${intent}`, entity: 'room', entityId: roomId, orgId, metadata: { propertyId, from: room.listingIntent, to: intent } }, batch);
  await batch.commit();
  const status = deriveListingStatus({ intent, propertyVerification: property.verification, operationalStatus: room.operationalStatus, inventory: room.inventory });
  return { listingStatus: status };
});

/** "List all eligible vacancies" — one click, one batch, one audit entry per room. */
export const listAllEligibleRooms = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const propertyId = id(d, 'propertyId');
  const member = await requirePermission(caller, orgId, 'listings.publish', propertyId);
  const propSnap = await db.doc(paths.property(orgId, propertyId)).get();
  if (!propSnap.exists) return notFound('property');
  const property = propSnap.data() as Property;
  const rooms = await db.collection(paths.rooms(orgId, propertyId)).where('listingIntent', '==', 'unlisted').get();
  const eligible = rooms.docs.filter((s) => {
    const r = s.data() as Room;
    return r.inventory && isEligibleForOneClickListing({ intent: r.listingIntent, propertyVerification: property.verification, operationalStatus: r.operationalStatus, inventory: r.inventory });
  });
  const t = Date.now();
  for (let i = 0; i < eligible.length; i += 200) {
    const batch = db.batch();
    for (const s of eligible.slice(i, i + 200)) {
      batch.update(s.ref, { listingIntent: 'listed', updatedAt: t });
      await audit({ actorUid: caller.uid, actorRole: roleLabel(caller, member), action: 'room.published', entity: 'room', entityId: s.id, orgId, metadata: { propertyId, bulk: true } }, batch);
    }
    await batch.commit();
  }
  return { listed: eligible.length };
});

// ───────────── verification submission ─────────────

export const submitPropertyForVerification = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const propertyId = id(d, 'propertyId');
  await requireOwner(caller, orgId, 'property.submit_verification');
  const ref = db.doc(paths.property(orgId, propertyId));
  const snap = await ref.get();
  if (!snap.exists) return notFound('property');
  const p = snap.data() as Property;
  if (!['draft', 'changes_requested', 'rejected'].includes(p.verification)) badInput('This property has already been submitted.');
  const rooms = await db.collection(paths.rooms(orgId, propertyId)).limit(1).get();
  const missing: string[] = [];
  if (!p.address?.line1 || !p.address?.pincode) missing.push('address');
  if ((p.photos ?? []).length < 1) missing.push('at least one property photo');
  if (rooms.empty) missing.push('at least one room');
  if (missing.length) badInput(`Please add ${missing.join(', ')} before submitting.`);

  const t = Date.now();
  const batch = db.batch();
  batch.update(ref, { verification: 'submitted', updatedAt: t });
  batch.set(db.doc(`verificationRequests/${propertyId}`), { propertyId, orgId, status: 'pending', submittedBy: caller.uid, submittedAt: t, notes: null });
  await audit({ actorUid: caller.uid, actorRole: 'owner', action: 'property.submitted', entity: 'property', entityId: propertyId, orgId }, batch);
  await batch.commit();
  return { ok: true };
});
