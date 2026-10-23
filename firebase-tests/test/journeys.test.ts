/**
 * THIKANO critical journeys (master spec §81–85) against the full emulator suite:
 * Auth + Firestore + Cloud Functions (real triggers and callables).
 *
 *   npm run test:journeys   (root)
 */
import { initializeApp as initAdmin, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminDb } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithCustomToken, type Auth } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, query, setDoc, where, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PROJECT = 'demo-thikano';
const REGION = 'asia-south1';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run inside `firebase emulators:exec` (FIRESTORE_EMULATOR_HOST missing).');

// Admin SDK only for platform bootstrap (first admin claim, provider catalog) — like scripts in production.
if (!getAdminApps().length) initAdmin({ projectId: PROJECT });
const adminDb = getAdminDb();
const adminAuth = getAdminAuth();

interface Client {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  fns: Functions;
  call: <T = any>(name: string, data?: unknown) => Promise<T>;
}
const clients: FirebaseApp[] = [];
function client(name: string): Client {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'demo-key', authDomain: `${PROJECT}.firebaseapp.com` }, `${name}-${Math.random()}`);
  clients.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`, { disableWarnings: true });
  const db = getFirestore(app);
  const [h, p] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  connectFirestoreEmulator(db, h!, Number(p));
  const fns = getFunctions(app, REGION);
  connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  const call = async <T,>(fn: string, data: unknown = {}) => (await httpsCallable(fns, fn)(data)).data as T;
  return { app, auth, db, fns, call };
}

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, label: string, timeoutMs = 25_000): Promise<T> {
  const start = Date.now();
  let last: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      const v = await fn();
      if (v) return v as T;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for: ${label}${last ? ` (${String(last)})` : ''}`);
}

async function expectCallError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code: `functions/${code}` });
}

const T0 = Date.now();
const uniq = String(T0).slice(-6);
const ORG_NAME = `Sunrise Stays ${uniq}`;
const PROP_NAME = `Sunrise PG ${uniq}`;

const owner = client('owner');
const ownerB = client('ownerB');
const admin = client('admin');
const student = client('student');
const pub = client('public');

let orgId = '';
const propertyId = `prop-${uniq}`;
const roomId = `room-204-${uniq}`;
let roomSlugValue = '';
let leadId = '';
let bookingId = '';
const STUDENT_PHONE = `+9198${uniq}11`.slice(0, 13);
const WALKIN_PHONE = `+9197${uniq}22`.slice(0, 13);

beforeAll(async () => {
  await createUserWithEmailAndPassword(owner.auth, `owner-${uniq}@thikano.dev`, 'test-password-123');
  await createUserWithEmailAndPassword(ownerB.auth, `ownerb-${uniq}@thikano.dev`, 'test-password-123');
  const adminCred = await createUserWithEmailAndPassword(admin.auth, `admin-${uniq}@thikano.dev`, 'test-password-123');
  await adminAuth.setCustomUserClaims(adminCred.user.uid, { platformRole: 'platform_admin' });
  await admin.auth.currentUser!.getIdToken(true);

  // Platform config: one catalog-based laundry provider + revenue rules (admin-managed data).
  await adminDb.doc('providers/washwise').set({ id: 'washwise', name: 'WashWise Laundry', status: 'active', adapter: 'mock', categories: ['laundry'] });
  await adminDb.doc('providers/washwise/catalog/wash-fold').set({ sku: 'wash-fold', name: 'Wash & Fold (per kg)', category: 'laundry', price: 7000, unit: 'per kg', available: true });
  await adminDb.doc('revenueRules/rule-default').set({ id: 'rule-default', active: true, match: {}, providerBps: 8500, thikanoBps: 900, partnerBps: 400, otherFeesBps: 200, effectiveFrom: 0 });
  await adminDb.doc('revenueRules/rule-laundry').set({ id: 'rule-laundry', active: true, match: { category: 'laundry' }, providerBps: 7500, thikanoBps: 1300, partnerBps: 1000, otherFeesBps: 200, effectiveFrom: 0 });
}, 60_000);

afterAll(async () => {
  for (const a of clients) await deleteApp(a).catch(() => undefined);
});

describe('Journey 1 — Owner: property → rooms → beds → verify → list', () => {
  it('signs up and creates an organization', async () => {
    const profile = await owner.call<{ memberships: unknown[] }>('ensureProfile');
    expect(profile.memberships).toEqual([]);
    ({ orgId } = await owner.call<{ orgId: string }>('createOrganization', { name: ORG_NAME, ownerName: 'Shashank Agarwal' }));
    await owner.auth.currentUser!.getIdToken(true);
    const again = await owner.call<{ memberships: { orgId: string; role: string }[] }>('ensureProfile');
    expect(again.memberships).toEqual([expect.objectContaining({ orgId, role: 'owner' })]);
    await expectCallError(owner.call('createOrganization', { name: 'Second' }), 'already-exists');
  });

  it('creates property, building, floor, room and beds (rules-validated client writes)', async () => {
    const t = Date.now();
    const by = owner.auth.currentUser!.uid;
    const base = { orgId, createdBy: by, createdAt: t, updatedAt: t };
    await setDoc(doc(owner.db, `organizations/${orgId}/properties/${propertyId}`), {
      ...base, id: propertyId, name: PROP_NAME, kind: 'pg', genderRule: 'boys', description: 'Well-run boys PG near the Kukas college belt.',
      address: { line1: 'Plot 12, Kukas Main Road', locality: 'Kukas', city: 'Jaipur', state: 'Rajasthan', pincode: '302028' },
      location: { lat: 27.0306, lng: 75.8896 }, nearbyColleges: ['JECRC Foundation'], amenities: ['food', 'wifi', 'cctv'], rules: ['Gate closes at 10:30 PM'],
      photos: [{ id: 'ph1', kind: 'photo', storagePath: 'dev/p.jpg', url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2', sortOrder: 0 }], videos: [],
      foodIncluded: true, verification: 'draft', publicContactPhone: null,
    });
    await setDoc(doc(owner.db, `organizations/${orgId}/properties/${propertyId}/buildings/b0`), { ...base, id: 'b0', propertyId, name: 'Block A', sortOrder: 0 });
    await setDoc(doc(owner.db, `organizations/${orgId}/properties/${propertyId}/floors/f2`), { ...base, id: 'f2', propertyId, buildingId: 'b0', label: '2nd', level: 2 });
    await setDoc(doc(owner.db, `organizations/${orgId}/properties/${propertyId}/rooms/${roomId}`), {
      ...base, id: roomId, propertyId, buildingId: 'b0', floorId: 'f2', number: '204', sharing: 'double', description: 'Bright double room.',
      rent: 950000, deposit: 1000000, amenities: ['ac', 'wifi', 'attached_bathroom', 'study_table', 'cupboard'],
      photos: [{ id: 'r1', kind: 'photo', storagePath: 'dev/r.jpg', url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267', sortOrder: 0 }], videos: [],
      operationalStatus: 'active', listingIntent: 'unlisted',
    });
    for (const label of ['A', 'B']) {
      await setDoc(doc(owner.db, `organizations/${orgId}/properties/${propertyId}/beds/${roomId}-${label}`), { ...base, id: `${roomId}-${label}`, propertyId, roomId, label, status: 'available', residentId: null, rentOverride: null });
    }
  });

  it('derives slug + inventory from beds automatically (2 beds available)', async () => {
    const room = await waitFor(async () => {
      const s = await getDoc(doc(owner.db, `organizations/${orgId}/properties/${propertyId}/rooms/${roomId}`));
      const r = s.data();
      return r?.publicSlug && r.inventory?.availableBeds === 2 ? r : null;
    }, 'room slug + inventory');
    roomSlugValue = room.publicSlug;
    expect(roomSlugValue).toMatch(/^sunrise-pg-\d+-room-204/);
    expect(room.inventory).toMatchObject({ totalBeds: 2, availableBeds: 2, occupancy: 'empty' });
    const prop = await waitFor(async () => (await getDoc(doc(owner.db, `organizations/${orgId}/properties/${propertyId}`))).data()?.slug, 'property slug');
    expect(prop).toMatch(/^sunrise-pg-\d+-kukas/);
  });

  it('cannot go public before verification', async () => {
    const r = await owner.call<{ listingStatus: string }>('setRoomListing', { orgId, propertyId, roomId, intent: 'listed' });
    expect(r.listingStatus).toBe('pending_verification');
    await new Promise((res) => setTimeout(res, 1500));
    expect((await getDoc(doc(pub.db, `publicRooms/${roomId}`))).exists()).toBe(false);
  });

  it('another owner cannot list or read this room', async () => {
    await ownerB.call('ensureProfile');
    await expectCallError(ownerB.call('setRoomListing', { orgId, propertyId, roomId, intent: 'unlisted' }), 'permission-denied');
    await expect(getDoc(doc(ownerB.db, `organizations/${orgId}/properties/${propertyId}/rooms/${roomId}`))).rejects.toThrow();
  });

  it('owner submits, admin approves → room becomes public with live availability', async () => {
    await owner.call('submitPropertyForVerification', { orgId, propertyId });
    await expectCallError(owner.call('reviewProperty', { orgId, propertyId, decision: 'approve' }), 'permission-denied');
    await admin.call('reviewProperty', { orgId, propertyId, decision: 'approve' });
    const pr = await waitFor(async () => (await getDoc(doc(pub.db, `publicRooms/${roomId}`))).data(), 'publicRooms projection');
    expect(pr).toMatchObject({ listingStatus: 'published', availableBeds: 2, rent: 950000, number: '204', slug: roomSlugValue });
    expect(JSON.stringify(pr)).not.toContain('Plot 12');
    const pp = await waitFor(async () => (await getDoc(doc(pub.db, `publicProperties/${propertyId}`))).data(), 'publicProperties projection');
    expect(pp).toMatchObject({ availableBeds: 2, startingRent: 950000 });
    const logs = await adminDb.collection('auditLogs').where('entityId', 'in', [roomId, propertyId]).get();
    expect(logs.docs.map((d) => d.get('action'))).toEqual(expect.arrayContaining(['room.published', 'property.submitted', 'property.verified']));
  });
});

describe('Journey 2 — Student: public room link → enquiry, no app or login', () => {
  it('creates a lead from the shared room link and the owner is notified', async () => {
    await pub.call('trackRoomView', { slug: roomSlugValue });
    const r = await pub.call<{ leadId: string; duplicate: boolean }>('createLead', { slug: roomSlugValue, name: 'Aarav Sharma', phone: STUDENT_PHONE.replace('+91', ''), intent: 'interested', message: 'Is food included?' });
    leadId = r.leadId;
    expect(r.duplicate).toBe(false);
    const again = await pub.call<{ leadId: string; duplicate: boolean }>('createLead', { slug: roomSlugValue, name: 'Aarav Sharma', phone: STUDENT_PHONE, intent: 'interested' });
    expect(again).toEqual({ leadId, duplicate: true });

    const lead = (await getDoc(doc(owner.db, `organizations/${orgId}/leads/${leadId}`))).data();
    expect(lead).toMatchObject({ propertyId, roomId, status: 'new', source: 'room_share_link', phone: STUDENT_PHONE });
    const inbox = await getDocs(collection(owner.db, `users/${owner.auth.currentUser!.uid}/inbox`));
    expect(inbox.docs.some((d) => d.get('kind') === 'lead')).toBe(true);
    const room = (await getDoc(doc(owner.db, `organizations/${orgId}/properties/${propertyId}/rooms/${roomId}`))).data()!;
    expect(room.stats).toMatchObject({ enquiries: 1, views: 1 });
  });

  it('rejects invalid phone numbers and unknown rooms with friendly errors', async () => {
    await expectCallError(pub.call('createLead', { slug: roomSlugValue, name: 'X Y', phone: '12345', intent: 'interested' }), 'invalid-argument');
    await expectCallError(pub.call('createLead', { slug: 'no-such-room', name: 'X Y', phone: '9876543210', intent: 'interested' }), 'not-found');
  });
});

describe('Journey 3 — Move-in: application → approval → booking → resident', () => {
  it('walks the booking state machine and reserves a bed', async () => {
    ({ bookingId } = await owner.call<{ bookingId: string }>('startApplication', { orgId, leadId }));
    await expectCallError(owner.call('moveIn', { orgId, bookingId }), 'failed-precondition');
    await owner.call('advanceBooking', { orgId, bookingId, to: 'owner_review' });
    await owner.call('advanceBooking', { orgId, bookingId, to: 'approved' });
    await owner.call('advanceBooking', { orgId, bookingId, to: 'booked', bedId: `${roomId}-B` });
    const pr = await waitFor(async () => {
      const d = (await getDoc(doc(pub.db, `publicRooms/${roomId}`))).data();
      return d?.availableBeds === 1 ? d : null;
    }, 'availability drops to 1 after reservation');
    expect(pr.listingStatus).toBe('published');
    const lead = (await getDoc(doc(owner.db, `organizations/${orgId}/leads/${leadId}`))).data();
    expect(lead?.status).toBe('approved');
  });

  it('a student cannot move themselves in', async () => {
    await expectCallError(pub.call('moveIn', { orgId, bookingId }), 'unauthenticated');
  });

  it('move-in activates the resident, issues rent, and switches the app to Resident mode', async () => {
    const r = await owner.call<{ residentId: string; uid: string }>('moveIn', { orgId, bookingId, rentDueDay: 5 });
    const token = await adminAuth.createCustomToken(r.uid);
    await signInWithCustomToken(student.auth, token);
    const claims = (await student.auth.currentUser!.getIdTokenResult(true)).claims;
    expect(claims.stay).toEqual({ o: orgId, p: propertyId, r: r.residentId });

    const profile = await student.call<{ profile: { activeStay: unknown } }>('ensureProfile');
    expect(profile.profile.activeStay).toEqual({ orgId, propertyId, residentId: r.residentId });
    const me = (await getDoc(doc(student.db, `organizations/${orgId}/residents/${r.residentId}`))).data();
    expect(me).toMatchObject({ roomId, bedId: `${roomId}-B`, status: 'active', rent: 950000 });
    const invoices = await getDocs(query(collection(student.db, `organizations/${orgId}/invoices`), where('residentUid', '==', r.uid)));
    expect(invoices.size).toBe(1);
    const booking = (await getDoc(doc(owner.db, `organizations/${orgId}/bookings/${bookingId}`))).data();
    expect(booking?.stage).toBe('moved_in');
    expect((await getDoc(doc(owner.db, `organizations/${orgId}/leads/${leadId}`))).get('status')).toBe('converted');
  });

  it('filling the last bed makes the room fully occupied and unsearchable — automatically', async () => {
    await owner.call('addResident', { orgId, propertyId, bedId: `${roomId}-A`, name: 'Kabir Shekhawat', phone: WALKIN_PHONE });
    const pr = await waitFor(async () => {
      const d = (await getDoc(doc(pub.db, `publicRooms/${roomId}`))).data();
      return d?.availableBeds === 0 ? d : null;
    }, 'room fully occupied');
    expect(pr.listingStatus).toBe('fully_occupied');
    const pp = await waitFor(async () => {
      const d = (await getDoc(doc(pub.db, `publicProperties/${propertyId}`))).data();
      return d?.availableBeds === 0 ? d : null;
    }, 'property shows 0 beds');
    expect(pp.startingRent).toBeNull();
    await expectCallError(pub.call('createLead', { slug: roomSlugValue, name: 'Late Student', phone: '9123456780', intent: 'interested' }), 'failed-precondition');
  });

  it('the resident cannot see other residents or owner data', async () => {
    const others = await getDocs(query(collection(owner.db, `organizations/${orgId}/residents`), where('propertyId', '==', propertyId)));
    const other = others.docs.find((d) => d.get('uid') !== student.auth.currentUser!.uid)!;
    await expect(getDoc(doc(student.db, `organizations/${orgId}/residents/${other.id}`))).rejects.toThrow();
    await expect(getDoc(doc(student.db, `organizations/${orgId}/leads/${leadId}`))).rejects.toThrow();
    await expectCallError(student.call('getPartnerEarnings', { orgId, propertyId }), 'permission-denied');
  });
});

describe('Journey 4 — Daily resident: maintenance, rent, services → partner earnings', () => {
  it('raises maintenance with location auto-filled from the stay', async () => {
    const { issueId } = await student.call<{ issueId: string }>('raiseMaintenance', { category: 'ac', description: 'AC not cooling' });
    const issue = (await getDoc(doc(owner.db, `organizations/${orgId}/maintenance/${issueId}`))).data();
    expect(issue).toMatchObject({ propertyId, buildingId: 'b0', floorId: 'f2', roomId, bedId: `${roomId}-B`, status: 'open' });
  });

  it('pays rent online in test mode — invoice becomes paid with a receipt', async () => {
    const uid = student.auth.currentUser!.uid;
    const inv = (await getDocs(query(collection(student.db, `organizations/${orgId}/invoices`), where('residentUid', '==', uid)))).docs[0]!;
    const r = await student.call<{ status: string; receiptNo: string; mode: string }>('payRentOnline', { invoiceId: inv.id });
    expect(r).toMatchObject({ status: 'paid', mode: 'test' });
    expect(r.receiptNo).toMatch(/^TK-/);
    await expectCallError(student.call('payRentOnline', { invoiceId: inv.id }), 'invalid-argument');
  });

  it('orders laundry at catalog price; delivery credits the partner share to the owner', async () => {
    const catalog = await student.call<{ providers: { providerId: string; items: { sku: string; price: number }[] }[] }>('getServiceCatalog', { category: 'laundry' });
    expect(catalog.providers[0]!.items[0]).toMatchObject({ sku: 'wash-fold', price: 7000 });
    const order = await student.call<{ orderId: string; gross: number }>('placeServiceOrder', { providerId: 'washwise', items: [{ sku: 'wash-fold', qty: 3, price: 1 }] });
    expect(order.gross).toBe(21000); // client-sent price ignored
    await student.call('updateServiceOrderStatus', { orgId, orderId: order.orderId, status: 'delivered' });
    const entry = await waitFor(async () => (await getDoc(doc(owner.db, `organizations/${orgId}/ledger/${order.orderId}`))).data(), 'partner ledger entry');
    expect(entry.partner).toBe(2100); // 10% laundry partner share
    const platform = (await adminDb.doc(`platformLedger/${order.orderId}`).get()).data()!;
    expect(platform.provider + platform.thikano + platform.partner + platform.otherFees).toBe(21000);
    const earnings = await owner.call<{ total: number; byCategory: Record<string, number> }>('getPartnerEarnings', { orgId, propertyId });
    expect(earnings.byCategory.laundry).toBeGreaterThanOrEqual(2100);
    await expect(getDoc(doc(owner.db, `platformLedger/${order.orderId}`))).rejects.toThrow();
  });
});

describe('Journey 4b — Resident home, notices, and move-out', () => {
  it('getResidentHome returns only the stay data of the signed-in resident', async () => {
    const h = await student.call<{ room: { number: string }; bed: { label: string }; roommates: string[]; invoices: { status: string }[]; issues: unknown[]; resident: { name: string } }>('getResidentHome');
    expect(h.room.number).toBe('204');
    expect(h.bed.label).toBe('B');
    expect(h.roommates).toEqual(['Kabir']); // first names only
    expect(h.invoices[0]!.status).toBe('paid');
    expect(h.issues.length).toBeGreaterThanOrEqual(1);
    await expectCallError(pub.call('getResidentHome'), 'unauthenticated');
    await expectCallError(owner.call('getResidentHome'), 'permission-denied');
  });

  it('publishing a notice lands in the resident inbox once', async () => {
    const t = Date.now();
    await setDoc(doc(owner.db, `organizations/${orgId}/notices/n-${uniq}`), { id: `n-${uniq}`, orgId, propertyId, buildingIds: null, title: 'Water maintenance', body: 'Tank cleaning 6–7 PM', startsAt: null, endsAt: null, publishedAt: t, createdAt: t, updatedAt: t, createdBy: owner.auth.currentUser!.uid });
    const inbox = await waitFor(async () => {
      const s = await getDocs(collection(student.db, `users/${student.auth.currentUser!.uid}/inbox`));
      const hit = s.docs.filter((d) => d.get('kind') === 'notice');
      return hit.length ? hit : null;
    }, 'notice in resident inbox');
    expect(inbox).toHaveLength(1);
    await expect(getDocs(collection(owner.db, `users/${student.auth.currentUser!.uid}/inbox`))).rejects.toThrow();
  });

  it('move-out frees the bed, restores availability, and returns the app to Discover', async () => {
    const res = (await getDocs(query(collection(owner.db, `organizations/${orgId}/residents`), where('bedId', '==', `${roomId}-B`), where('status', 'in', ['active', 'notice'])))).docs[0]!;
    await owner.call('startMoveOut', { orgId, residentId: res.id, moveOutDate: Date.now() + 2 * 86_400_000 });
    await owner.call('completeMoveOut', { orgId, residentId: res.id });
    const pr = await waitFor(async () => {
      const d = (await getDoc(doc(pub.db, `publicRooms/${roomId}`))).data();
      return d?.availableBeds === 1 && d.listingStatus === 'published' ? d : null;
    }, 'room back to 1 available');
    expect(pr.listingStatus).toBe('published');
    const claims = (await student.auth.currentUser!.getIdTokenResult(true)).claims;
    expect(claims.stay).toBeUndefined();
    const profile = await student.call<{ profile: { activeStay: unknown } }>('ensureProfile');
    expect(profile.profile.activeStay).toBeNull();
    const audit = await adminDb.collection('auditLogs').where('entityId', '==', res.id).get();
    expect(audit.docs.map((d) => d.get('action'))).toEqual(expect.arrayContaining(['resident.assigned_to_bed', 'resident.notice_started', 'resident.moved_out']));
  });
});

describe('Journey 5 — Phone OTP sign-in', () => {
  it('signs in with a valid code, rejects wrong codes, and rate-limits requests', async () => {
    const phone = `9${uniq}0099`.slice(0, 10);
    const otp = client('otp');
    const r = await otp.call<{ challengeId: string; devCode: string }>('requestOtp', { phone });
    expect(r.devCode).toMatch(/^\d{6}$/);
    const wrong = r.devCode === '000000' ? '111111' : '000000';
    await expectCallError(otp.call('verifyOtp', { challengeId: r.challengeId, code: wrong }), 'invalid-argument');
    const { token } = await otp.call<{ token: string }>('verifyOtp', { challengeId: r.challengeId, code: r.devCode });
    const cred = await signInWithCustomToken(otp.auth, token);
    expect(cred.user.uid).toBeTruthy();
    await expectCallError(otp.call('verifyOtp', { challengeId: r.challengeId, code: r.devCode }), 'deadline-exceeded'); // single use
    await otp.call('requestOtp', { phone });
    await otp.call('requestOtp', { phone });
    await expectCallError(otp.call('requestOtp', { phone }), 'resource-exhausted');
  });
});

describe('Journey 6 — Owner insights', () => {
  it('reports vacancy and demand deterministically from real search events', async () => {
    await pub.call('logSearch', { area: 'Kukas', lat: 27.03, lng: 75.89, maxRent: 1000000, sharing: 'double', results: 3, sessionId: `s-${uniq}` });
    const ins = await owner.call<{ vacantBeds: number; demand: { studentsSearchingNearby: number } }>('getPropertyInsights', { orgId, propertyId });
    expect(ins.vacantBeds).toBe(1); // the bed freed by move-out in Journey 4b
    expect(ins.demand.studentsSearchingNearby).toBeGreaterThanOrEqual(1);
  });
});
