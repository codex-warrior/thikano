import { onCall } from 'firebase-functions/v2/https';
import {
  advanceBooking as advanceStage,
  bookingHoldsBed,
  dueDateFor,
  formatINR,
  leadStatusForBooking,
  proratedRent,
  transitionBed,
  type Bed,
  type Booking,
  type BookingStage,
  type Lead,
  type LeadSource,
  type PublicRoom,
  type Resident,
  type Room,
} from '@thikano/domain';
import { db, FieldValue, isEmulator, paths } from './lib/admin';
import { bump } from './lib/analytics';
import { audit } from './lib/audit';
import { requireAuth, requirePermission, roleLabel, type Caller } from './lib/authz';
import { badInput, fail, notFound } from './lib/errors';
import { notifyOrg, notifyUsers } from './lib/notify';
import { findExistingUid, hasActiveStay, issueInvite, setStayClaim } from './lib/stay';
import { rateLimit } from './lib/rate-limit';
import { id, indianPhone, int, obj, oneOf, optEmail, optInt, optStr, str } from './lib/validate';

const DAY = 86_400_000;

// App Check: enforced in production for public callables; the emulator has no attestation.
const PUBLIC_OPTS = { enforceAppCheck: process.env.THIKANO_ENFORCE_APP_CHECK === 'true' && !isEmulator() };

async function resolveSlug(slug: string) {
  const snap = await db.doc(`slugs/${slug}`).get();
  return snap.exists ? (snap.data() as { kind: 'property' | 'room'; id: string; orgId: string; propertyId: string }) : null;
}

// ───────────────────────── Public: enquiries ─────────────────────────

/**
 * "I'm interested" / "Request a visit" from a public room/property page or Discover.
 * No app install or sign-in required. The org is resolved server-side from the slug.
 */
export const createLead = onCall(PUBLIC_OPTS, async (req) => {
  const d = obj(req.data);
  const slug = str(d, 'slug', { pattern: /^[a-z0-9-]{1,90}$/ });
  const name = str(d, 'name', { min: 2, max: 60 });
  const phone = indianPhone(d);
  const intent = oneOf(d, 'intent', ['interested', 'visit'] as const);
  const message = optStr(d, 'message', 500);
  const expectedMoveIn = optInt(d, 'expectedMoveIn', { min: Date.now() - DAY, max: Date.now() + 365 * DAY });
  const visitAt = intent === 'visit' ? optInt(d, 'visitAt', { min: Date.now() - DAY, max: Date.now() + 90 * DAY }) : null;
  const sourceHint = d.source === 'qr' ? 'qr' : d.source === 'discover' ? 'discover' : null;

  const target = await resolveSlug(slug);
  if (!target) return notFound('room');
  const ip = req.rawRequest?.ip ?? 'unknown';
  await rateLimit(`lead:ip:${ip}`, 30, 60 * 60 * 1000);
  await rateLimit(`lead:phone:${phone}:${target.propertyId}`, 5, DAY, "You've already sent a few enquiries to this PG today. The owner will get back to you.");

  // Must currently be public.
  if (target.kind === 'room') {
    const pub = await db.doc(`publicRooms/${target.id}`).get();
    if (!pub.exists || (pub.data() as PublicRoom).listingStatus !== 'published') fail('failed-precondition', 'This room is no longer available.');
  } else {
    const pub = await db.doc(`publicProperties/${target.id}`).get();
    if (!pub.exists) fail('failed-precondition', 'This PG is not taking enquiries right now.');
  }
  const roomId = target.kind === 'room' ? target.id : null;
  const source: LeadSource = sourceHint ?? (target.kind === 'room' ? 'room_share_link' : 'property_share_link');
  const studentUid = req.auth?.uid ?? null;

  // Dedupe: an open lead from the same phone for the same room/property in the last 7 days.
  const leadsCol = db.collection(paths.orgCol(target.orgId, 'leads'));
  const recent = await leadsCol.where('phone', '==', phone).where('propertyId', '==', target.propertyId).where('createdAt', '>=', Date.now() - 7 * DAY).limit(5).get();
  const dupe = recent.docs.find((s) => (s.data() as Lead).roomId === roomId && !['rejected', 'lost', 'converted'].includes((s.data() as Lead).status));
  if (dupe) return { leadId: dupe.id, duplicate: true };

  const t = Date.now();
  const leadRef = leadsCol.doc();
  const lead: Lead = {
    id: leadRef.id, orgId: target.orgId, propertyId: target.propertyId, roomId, bedId: null, studentUid, name, phone,
    expectedMoveIn, message: message ?? '', source, status: intent === 'visit' ? 'interested' : 'new', bookingId: null,
    createdAt: t, updatedAt: t, createdBy: studentUid ?? 'public',
  };
  const batch = db.batch();
  batch.set(leadRef, lead);
  if (intent === 'visit' && roomId) {
    const room = (await db.doc(paths.room(target.orgId, target.propertyId, roomId)).get()).data() as Room;
    const bRef = db.collection(paths.orgCol(target.orgId, 'bookings')).doc();
    const booking: Booking = {
      id: bRef.id, orgId: target.orgId, propertyId: target.propertyId, roomId, bedId: null, leadId: leadRef.id, studentUid, studentName: name,
      stage: 'visit_requested', visitAt, moveInDate: expectedMoveIn, rent: room.rent, deposit: room.deposit,
      history: [{ stage: 'inquiry', at: t, by: studentUid ?? 'public' }, { stage: 'visit_requested', at: t, by: studentUid ?? 'public' }],
      createdAt: t, updatedAt: t, createdBy: studentUid ?? 'public',
    };
    batch.set(bRef, booking);
    batch.update(leadRef, { bookingId: bRef.id });
  }
  if (roomId) batch.update(db.doc(paths.room(target.orgId, target.propertyId, roomId)), { 'stats.enquiries': FieldValue.increment(1) });
  await batch.commit();

  await bump(['platform', `property_${target.propertyId}`, ...(roomId ? [`room_${roomId}`] : [])], { enquiries: 1 });
  await notifyOrg(target.orgId, target.propertyId, 'leads.read', {
    kind: 'lead',
    title: intent === 'visit' ? 'Visit requested' : 'New enquiry',
    body: `${name} is interested${roomId ? ` in Room ${(await db.doc(paths.room(target.orgId, target.propertyId, roomId)).get()).get('number')}` : ''}`,
    link: `/leads?lead=${leadRef.id}`,
  });
  return { leadId: leadRef.id, duplicate: false };
});

/** Public view counter for room pages (deduped per IP per room per hour). */
export const trackRoomView = onCall(PUBLIC_OPTS, async (req) => {
  const d = obj(req.data);
  const slug = str(d, 'slug', { pattern: /^[a-z0-9-]{1,90}$/ });
  const target = await resolveSlug(slug);
  if (!target || target.kind !== 'room') return { ok: false };
  const ip = req.rawRequest?.ip ?? 'unknown';
  try {
    await rateLimit(`view:${ip}:${target.id}`, 1, 60 * 60 * 1000);
  } catch {
    return { ok: true, counted: false };
  }
  await db.doc(paths.room(target.orgId, target.propertyId, target.id)).update({ 'stats.views': FieldValue.increment(1) });
  await bump(['platform', `property_${target.propertyId}`, `room_${target.id}`], { views: 1 });
  return { ok: true, counted: true };
});

export const trackShare = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const propertyId = id(d, 'propertyId');
  const roomId = d.roomId ? id(d, 'roomId') : null;
  await requirePermission(caller, orgId, 'inventory.read', propertyId);
  if (roomId) await db.doc(paths.room(orgId, propertyId, roomId)).update({ 'stats.shares': FieldValue.increment(1) });
  await bump(['platform', `property_${propertyId}`, ...(roomId ? [`room_${roomId}`] : [])], { shares: 1 });
  return { ok: true };
});

/** Anonymous search analytics for demand intelligence. No phone/uid stored. */
export const logSearch = onCall(PUBLIC_OPTS, async (req) => {
  const d = obj(req.data);
  const ip = req.rawRequest?.ip ?? 'unknown';
  await rateLimit(`search:${ip}`, 120, 60 * 60 * 1000);
  const area = optStr(d, 'area', 60);
  const college = optStr(d, 'college', 80);
  const sessionId = optStr(d, 'sessionId', 40);
  const lat = typeof d.lat === 'number' ? Math.round(d.lat * 100) / 100 : null; // ~1 km precision
  const lng = typeof d.lng === 'number' ? Math.round(d.lng * 100) / 100 : null;
  const maxRent = optInt(d, 'maxRent', { min: 0, max: 100_000_00 });
  const sharing = typeof d.sharing === 'string' && ['single', 'double', 'triple', 'quad', 'dorm'].includes(d.sharing) ? d.sharing : null;
  const results = optInt(d, 'results', { min: 0, max: 10_000 }) ?? 0;
  const filters = Array.isArray(d.filters) ? (d.filters as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 10) : [];
  await db.collection('searchEvents').add({ at: Date.now(), area, college, lat, lng, maxRent, sharing, filters, results, sessionId });
  await bump(['platform'], { searches: 1 });
  return { ok: true };
});

// ───────────────────────── Owner: pipeline ─────────────────────────

async function loadBooking(orgId: string, bookingId: string) {
  const ref = db.doc(`${paths.orgCol(orgId, 'bookings')}/${bookingId}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound('booking');
  return { ref, booking: snap.data() as Booking };
}

/** Owner turns a lead into a pipeline booking (application) — or it already has one from a visit request. */
export const startApplication = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const leadId = id(d, 'leadId');
  const leadRef = db.doc(`${paths.orgCol(orgId, 'leads')}/${leadId}`);
  const leadSnap = await leadRef.get();
  if (!leadSnap.exists) return notFound('lead');
  const lead = leadSnap.data() as Lead;
  const member = await requirePermission(caller, orgId, 'leads.write', lead.propertyId);
  if (lead.bookingId) return { bookingId: lead.bookingId };
  const roomId = d.roomId ? id(d, 'roomId') : lead.roomId;
  if (!roomId) badInput('Please choose a room for this application.');
  const room = (await db.doc(paths.room(orgId, lead.propertyId, roomId!)).get()).data() as Room | undefined;
  if (!room) return notFound('room');
  const t = Date.now();
  const bRef = db.collection(paths.orgCol(orgId, 'bookings')).doc();
  const booking: Booking = {
    id: bRef.id, orgId, propertyId: lead.propertyId, roomId: roomId!, bedId: null, leadId, studentUid: lead.studentUid ?? null, studentName: lead.name,
    stage: 'application', visitAt: null, moveInDate: lead.expectedMoveIn ?? null, rent: room.rent, deposit: room.deposit,
    history: [{ stage: 'inquiry', at: lead.createdAt, by: lead.createdBy }, { stage: 'application', at: t, by: caller.uid }],
    createdAt: t, updatedAt: t, createdBy: caller.uid,
  };
  const batch = db.batch();
  batch.set(bRef, booking);
  batch.update(leadRef, { bookingId: bRef.id, status: 'applied', updatedAt: t });
  batch.update(db.doc(paths.room(orgId, lead.propertyId, roomId!)), { 'stats.applications': FieldValue.increment(1) });
  await audit({ actorUid: caller.uid, actorRole: roleLabel(caller, member), action: 'booking.application_started', entity: 'booking', entityId: bRef.id, orgId, metadata: { leadId } }, batch);
  await batch.commit();
  return { bookingId: bRef.id };
});

/**
 * Moves a booking through the domain state machine. `booked` reserves a bed;
 * cancelling/rejecting a booked booking releases it. `moved_in` is only via moveIn.
 */
export const advanceBooking = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const bookingId = id(d, 'bookingId');
  const to = oneOf(d, 'to', ['visit_requested', 'visit_scheduled', 'application', 'owner_review', 'approved', 'rejected', 'booked', 'cancelled'] as const satisfies readonly BookingStage[]);
  const { ref, booking } = await loadBooking(orgId, bookingId);
  const member = await requirePermission(caller, orgId, 'leads.write', booking.propertyId);
  const note = optStr(d, 'note', 300);
  const visitAt = to === 'visit_scheduled' ? int(d, 'visitAt', { min: Date.now() - DAY }) : booking.visitAt ?? null;
  const bedId = to === 'booked' ? id(d, 'bedId') : booking.bedId ?? null;

  await db.runTransaction(async (tx) => {
    const fresh = (await tx.get(ref)).data() as Booking;
    let next: BookingStage;
    try {
      next = advanceStage(fresh.stage, to);
    } catch {
      return fail('failed-precondition', `This booking can't move from ${fresh.stage.replace('_', ' ')} to ${to.replace('_', ' ')}.`);
    }
    const t = Date.now();
    if (to === 'booked') {
      const bedRef = db.doc(paths.bed(orgId, fresh.propertyId, bedId!));
      const bed = (await tx.get(bedRef)).data() as Bed | undefined;
      if (!bed || bed.roomId !== fresh.roomId) return badInput('Please choose a bed in this room.');
      if (bed.status !== 'available') return fail('failed-precondition', 'That bed is no longer available.');
      tx.update(bedRef, { status: transitionBed(bed.status, 'reserve'), reservedForBookingId: bookingId, updatedAt: t });
    }
    if ((to === 'cancelled' || to === 'rejected') && bookingHoldsBed(fresh.stage) && fresh.bedId) {
      const bedRef = db.doc(paths.bed(orgId, fresh.propertyId, fresh.bedId));
      const bed = (await tx.get(bedRef)).data() as Bed | undefined;
      if (bed?.status === 'reserved' && bed.reservedForBookingId === bookingId) tx.update(bedRef, { status: transitionBed('reserved', 'release'), reservedForBookingId: null, updatedAt: t });
    }
    tx.update(ref, {
      stage: next,
      bedId,
      visitAt,
      updatedAt: t,
      history: FieldValue.arrayUnion({ stage: next, at: t, by: caller.uid, ...(note ? { note } : {}) }),
    });
    if (fresh.leadId) tx.update(db.doc(`${paths.orgCol(orgId, 'leads')}/${fresh.leadId}`), { status: leadStatusForBooking(next), updatedAt: t });
    await audit({ actorUid: caller.uid, actorRole: roleLabel(caller, member), action: `booking.${next}`, entity: 'booking', entityId: bookingId, orgId, metadata: { from: fresh.stage, bedId } }, tx);
  });
  if (booking.studentUid && ['visit_scheduled', 'approved', 'rejected', 'booked'].includes(to)) {
    const label = { visit_scheduled: 'Your visit is scheduled', approved: 'Application approved 🎉', rejected: 'Application update', booked: 'Your bed is booked' }[to as 'approved'];
    await notifyUsers([booking.studentUid], { kind: 'booking', title: label, body: `${booking.studentName}, check THIKANO for details.`, link: `/bookings/${bookingId}` });
  }
  return { ok: true };
});

// ───────────────────────── Move-in / residents ─────────────────────────

interface ActivateInput {
  caller: Caller;
  orgId: string;
  propertyId: string;
  bedId: string;
  name: string;
  phone: string;
  email: string | null;
  rent: number | null;
  deposit: number | null;
  moveInDate: number;
  rentDueDay: number;
  booking?: { ref: FirebaseFirestore.DocumentReference; booking: Booking } | null;
}

/**
 * The single path to becoming a resident. In one transaction: bed → occupied,
 * resident created, booking → moved_in, lead → converted, first invoice issued.
 * Then the user's activeStay + stay claim are set so the app switches mode.
 */
async function activateResident(i: ActivateInput) {
  const member = await requirePermission(i.caller, i.orgId, 'residents.write', i.propertyId);
  // Link to an EXISTING account only (booking student, verified email, or phone account).
  let uid = await findExistingUid({ studentUid: i.booking?.booking.studentUid ?? null, email: i.email, phone: i.phone });
  if (uid && (await hasActiveStay(uid))) {
    if (i.booking?.booking.studentUid === uid) fail('failed-precondition', 'This student already has an active stay on THIKANO.');
    uid = null; // matched someone else's account by phone/email — fall back to an invite code
  }

  const resRef = db.collection(paths.orgCol(i.orgId, 'residents')).doc();
  const bedRef = db.doc(paths.bed(i.orgId, i.propertyId, i.bedId));
  const result = await db.runTransaction(async (tx) => {
    const bed = (await tx.get(bedRef)).data() as Bed | undefined;
    if (!bed) return notFound('bed');
    const roomRef = db.doc(paths.room(i.orgId, i.propertyId, bed.roomId));
    const room = (await tx.get(roomRef)).data() as Room;
    const bookingFresh = i.booking ? ((await tx.get(i.booking.ref)).data() as Booking) : null;

    if (bookingFresh) {
      if (bookingFresh.stage !== 'booked') return fail('failed-precondition', 'Approve and book this application before move-in.');
      if (bed.status !== 'reserved' || bed.reservedForBookingId !== bookingFresh.id) return fail('failed-precondition', 'The reserved bed for this booking has changed.');
    } else if (bed.status !== 'available') {
      return fail('failed-precondition', 'That bed is not available.');
    }
    const t = Date.now();
    const rent = i.rent ?? bed.rentOverride ?? room.rent;
    const deposit = i.deposit ?? room.deposit;
    const resident: Resident & { residentUid: string | null; email: string | null } = {
      id: resRef.id, orgId: i.orgId, propertyId: i.propertyId, roomId: bed.roomId, bedId: bed.id, uid, residentUid: uid, name: i.name, phone: i.phone, email: i.email,
      status: 'active', moveInDate: i.moveInDate, moveOutDate: null, rent, deposit, rentDueDay: i.rentDueDay, createdAt: t, updatedAt: t, createdBy: i.caller.uid,
    };
    tx.set(resRef, resident);
    tx.update(bedRef, { status: transitionBed(bed.status, 'assign'), residentId: resRef.id, reservedForBookingId: null, moveInDate: i.moveInDate, moveOutDate: null, updatedAt: t });

    // First invoice: pro-rated for the move-in month (IST).
    const ist = new Date(i.moveInDate + 330 * 60_000);
    const period = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 0)).getUTCDate();
    const amount = proratedRent(rent, ist.getUTCDate(), daysInMonth);
    tx.set(db.doc(`${paths.orgCol(i.orgId, 'invoices')}/inv-${resRef.id}-${period}`), {
      id: `inv-${resRef.id}-${period}`, orgId: i.orgId, propertyId: i.propertyId, residentId: resRef.id, residentUid: uid, period,
      amount, lateFee: 0, paid: 0, dueDate: Math.max(i.moveInDate, dueDateFor(period, i.rentDueDay)), status: 'due', prorated: amount !== rent,
      createdAt: t, updatedAt: t, createdBy: i.caller.uid,
    });
    if (bookingFresh) {
      tx.update(i.booking!.ref, { stage: 'moved_in', updatedAt: t, history: FieldValue.arrayUnion({ stage: 'moved_in', at: t, by: i.caller.uid }) });
      if (bookingFresh.leadId) tx.update(db.doc(`${paths.orgCol(i.orgId, 'leads')}/${bookingFresh.leadId}`), { status: 'converted', updatedAt: t });
      tx.update(roomRef, { 'stats.bookings': FieldValue.increment(1) });
    }
    if (uid) tx.set(db.doc(`users/${uid}`), { uid, activeStay: { orgId: i.orgId, propertyId: i.propertyId, residentId: resRef.id } }, { merge: true });
    await audit({ actorUid: i.caller.uid, actorRole: roleLabel(i.caller, member), action: 'resident.assigned_to_bed', entity: 'resident', entityId: resRef.id, orgId: i.orgId, metadata: { bedId: i.bedId, roomId: bed.roomId, bookingId: bookingFresh?.id ?? null } }, tx);
    return { residentId: resRef.id, roomNumber: room.number, rent };
  });

  if (uid) {
    await setStayClaim(uid, { o: i.orgId, p: i.propertyId, r: result.residentId });
    await notifyUsers([uid], { kind: 'system', title: 'Welcome home 🏠', body: `You're all set in Room ${result.roomNumber}. Rent ${formatINR(result.rent)}/month.`, link: 'thikano://home' });
    return { residentId: result.residentId, uid, inviteCode: null };
  }
  const inviteCode = await issueInvite(i.orgId, i.propertyId, result.residentId);
  return { residentId: result.residentId, uid: null, inviteCode };
}

/** Move-in from an approved + booked application. */
export const moveIn = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const bookingId = id(d, 'bookingId');
  const b = await loadBooking(orgId, bookingId);
  if (!b.booking.bedId) fail('failed-precondition', 'Book a bed for this application first.');
  const lead = b.booking.leadId ? ((await db.doc(`${paths.orgCol(orgId, 'leads')}/${b.booking.leadId}`).get()).data() as Lead | undefined) : undefined;
  const phone = d.phone ? indianPhone(d) : lead?.phone;
  if (!phone) badInput("Please add the student's mobile number.");
  return activateResident({
    caller, orgId, propertyId: b.booking.propertyId, bedId: b.booking.bedId!, name: b.booking.studentName, phone: phone!, email: optEmail(d),
    rent: b.booking.rent, deposit: b.booking.deposit, moveInDate: optInt(d, 'moveInDate') ?? b.booking.moveInDate ?? Date.now(),
    rentDueDay: optInt(d, 'rentDueDay', { min: 1, max: 28 }) ?? 5, booking: b,
  });
});

/** Direct assignment (walk-in / existing resident onboarding) to an available bed. */
export const addResident = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  return activateResident({
    caller, orgId: id(d, 'orgId'), propertyId: id(d, 'propertyId'), bedId: id(d, 'bedId'), name: str(d, 'name', { min: 2, max: 60 }), phone: indianPhone(d), email: optEmail(d),
    rent: optInt(d, 'rent', { min: 0, max: 10_000_000 }), deposit: optInt(d, 'deposit', { min: 0, max: 10_000_000 }),
    moveInDate: optInt(d, 'moveInDate') ?? Date.now(), rentDueDay: optInt(d, 'rentDueDay', { min: 1, max: 28 }) ?? 5,
  });
});

/** Resident gives notice: bed stays occupied, shows as an upcoming vacancy. */
export const startMoveOut = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const residentId = id(d, 'residentId');
  const moveOutDate = int(d, 'moveOutDate', { min: Date.now() - 30 * DAY, max: Date.now() + 180 * DAY });
  const resRef = db.doc(`${paths.orgCol(orgId, 'residents')}/${residentId}`);
  const res = (await resRef.get()).data() as Resident | undefined;
  if (!res) return notFound('resident');
  const member = await requirePermission(caller, orgId, 'residents.write', res.propertyId);
  if (res.status !== 'active') badInput('This resident is not active.');
  const t = Date.now();
  const batch = db.batch();
  batch.update(resRef, { status: 'notice', moveOutDate, updatedAt: t });
  batch.update(db.doc(paths.bed(orgId, res.propertyId, res.bedId)), { moveOutDate, updatedAt: t });
  await audit({ actorUid: caller.uid, actorRole: roleLabel(caller, member), action: 'resident.notice_started', entity: 'resident', entityId: residentId, orgId, metadata: { moveOutDate } }, batch);
  await batch.commit();
  return { ok: true };
});

/** Completes move-out: bed → available (listing availability updates automatically). */
export const completeMoveOut = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const residentId = id(d, 'residentId');
  const resRef = db.doc(`${paths.orgCol(orgId, 'residents')}/${residentId}`);
  const res = (await resRef.get()).data() as Resident | undefined;
  if (!res) return notFound('resident');
  const member = await requirePermission(caller, orgId, 'residents.write', res.propertyId);
  await db.runTransaction(async (tx) => {
    const bedRef = db.doc(paths.bed(orgId, res.propertyId, res.bedId));
    const bed = (await tx.get(bedRef)).data() as Bed;
    const t = Date.now();
    if (bed.status === 'occupied' && bed.residentId === residentId) {
      tx.update(bedRef, { status: transitionBed('occupied', 'vacate'), residentId: null, moveInDate: null, moveOutDate: null, updatedAt: t });
    }
    tx.update(resRef, { status: 'moved_out', moveOutDate: res.moveOutDate ?? t, updatedAt: t });
    if (res.uid) tx.set(db.doc(`users/${res.uid}`), { activeStay: null }, { merge: true });
    const code = (res as Resident & { inviteCode?: string | null }).inviteCode;
    if (code) tx.delete(db.doc(`residentInvites/${code}`));
    await audit({ actorUid: caller.uid, actorRole: roleLabel(caller, member), action: 'resident.moved_out', entity: 'resident', entityId: residentId, orgId, metadata: { bedId: res.bedId } }, tx);
  });
  if (res.uid) await setStayClaim(res.uid, null);
  return { ok: true };
});

/** Owner moves a resident to another available bed (room transfer). */
export const transferResident = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const residentId = id(d, 'residentId');
  const toBedId = id(d, 'toBedId');
  const resRef = db.doc(`${paths.orgCol(orgId, 'residents')}/${residentId}`);
  const res = (await resRef.get()).data() as Resident | undefined;
  if (!res) return notFound('resident');
  const member = await requirePermission(caller, orgId, 'residents.write', res.propertyId);
  await db.runTransaction(async (tx) => {
    const fromRef = db.doc(paths.bed(orgId, res.propertyId, res.bedId));
    const toRef = db.doc(paths.bed(orgId, res.propertyId, toBedId));
    const [from, to] = [(await tx.get(fromRef)).data() as Bed, (await tx.get(toRef)).data() as Bed | undefined];
    if (!to) return notFound('bed');
    if (to.status !== 'available') return fail('failed-precondition', 'That bed is not available.');
    const t = Date.now();
    tx.update(fromRef, { status: transitionBed(from.status, 'vacate'), residentId: null, moveInDate: null, moveOutDate: null, updatedAt: t });
    tx.update(toRef, { status: transitionBed('available', 'assign'), residentId, moveInDate: res.moveInDate, updatedAt: t });
    tx.update(resRef, { bedId: toBedId, roomId: to.roomId, updatedAt: t });
    await audit({ actorUid: caller.uid, actorRole: roleLabel(caller, member), action: 'resident.room_changed', entity: 'resident', entityId: residentId, orgId, metadata: { fromBed: res.bedId, toBed: toBedId } }, tx);
  });
  return { ok: true };
});

