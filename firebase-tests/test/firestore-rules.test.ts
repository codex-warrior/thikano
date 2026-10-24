/**
 * Habistat Firestore security rules — tenant isolation & role tests.
 * Runs against the Firestore emulator (npm run test:firebase).
 * Requirements: docs/HABISTAT-SECURITY.md §Required tests.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const T = 1_760_000_000_000;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-thikano-rules',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (path: string, data: Record<string, unknown>) => setDoc(doc(db, path), data);
    // org A
    await put('organizations/orgA', { id: 'orgA', name: 'Sunrise Stays', ownerUid: 'ownerA' });
    await put('organizations/orgA/members/ownerA', { uid: 'ownerA', role: 'owner', propertyIds: null, status: 'active' });
    await put('organizations/orgA/members/mgrP1', { uid: 'mgrP1', role: 'manager', propertyIds: ['propA1'], status: 'active' });
    await put('organizations/orgA/members/staffMaint', { uid: 'staffMaint', role: 'staff', propertyIds: ['propA1'], status: 'active', permissions: ['maintenance.read', 'maintenance.write', 'inventory.read'] });
    await put('organizations/orgA/members/exStaff', { uid: 'exStaff', role: 'manager', propertyIds: null, status: 'removed' });
    for (const p of ['propA1', 'propA2']) {
      await put(`organizations/orgA/properties/${p}`, { id: p, orgId: 'orgA', name: p, verification: 'verified', slug: p, createdBy: 'ownerA', createdAt: T, updatedAt: T });
      await put(`organizations/orgA/properties/${p}/rooms/r1`, { id: 'r1', orgId: 'orgA', propertyId: p, number: '204', rent: 950000, deposit: 950000, listingIntent: 'unlisted', inventory: { availableBeds: 1 }, stats: { views: 0 }, publicSlug: `${p}-204`, createdBy: 'ownerA', createdAt: T, updatedAt: T });
      await put(`organizations/orgA/properties/${p}/beds/b1`, { id: 'b1', orgId: 'orgA', propertyId: p, roomId: 'r1', label: 'A', status: 'available', residentId: null, createdBy: 'ownerA', createdAt: T, updatedAt: T });
      await put(`organizations/orgA/properties/${p}/beds/b2`, { id: 'b2', orgId: 'orgA', propertyId: p, roomId: 'r1', label: 'B', status: 'occupied', residentId: 'res-a', createdBy: 'ownerA', createdAt: T, updatedAt: T });
    }
    await put('organizations/orgA/residents/res-a', { id: 'res-a', orgId: 'orgA', propertyId: 'propA1', uid: 'resA', name: 'Rohit', phone: '+919000000001' });
    await put('organizations/orgA/residents/res-b', { id: 'res-b', orgId: 'orgA', propertyId: 'propA1', uid: 'resB', name: 'Aman', phone: '+919000000002' });
    await put('organizations/orgA/invoices/inv-a', { orgId: 'orgA', propertyId: 'propA1', residentId: 'res-a', residentUid: 'resA', amount: 950000, paid: 0 });
    await put('organizations/orgA/invoices/inv-b', { orgId: 'orgA', propertyId: 'propA1', residentId: 'res-b', residentUid: 'resB', amount: 950000, paid: 0 });
    await put('organizations/orgA/maintenance/m-a', { orgId: 'orgA', propertyId: 'propA1', residentUid: 'resA', status: 'open', category: 'ac' });
    await put('organizations/orgA/leads/lead1', { orgId: 'orgA', propertyId: 'propA1', name: 'Student', phone: '+919811111111', status: 'new', createdAt: T });
    await put('organizations/orgA/leads/lead2', { orgId: 'orgA', propertyId: 'propA2', name: 'Student 2', phone: '+919822222222', status: 'new', createdAt: T });
    await put('organizations/orgA/ledger/l1', { orgId: 'orgA', propertyId: 'propA1', partner: 5000, period: '2026-10' });
    await put('organizations/orgA/notices/n1', { orgId: 'orgA', propertyId: 'propA1', title: 'Water', publishedAt: T, createdBy: 'ownerA', createdAt: T, updatedAt: T });
    await put('organizations/orgA/notices/n-draft', { orgId: 'orgA', propertyId: 'propA1', title: 'Draft', publishedAt: null, createdBy: 'ownerA', createdAt: T, updatedAt: T });
    // org B
    await put('organizations/orgB', { id: 'orgB', name: 'Rathore', ownerUid: 'ownerB' });
    await put('organizations/orgB/members/ownerB', { uid: 'ownerB', role: 'owner', propertyIds: null, status: 'active' });
    await put('organizations/orgB/properties/propB1', { id: 'propB1', orgId: 'orgB', name: 'Green House', verification: 'verified' });
    await put('organizations/orgB/residents/res-x', { id: 'res-x', orgId: 'orgB', propertyId: 'propB1', uid: 'resX' });
    // platform
    await put('publicRooms/r1', { roomId: 'r1', rent: 950000, availableBeds: 1 });
    await put('publicProperties/propA1', { name: 'Sunrise PG' });
    await put('revenueRules/default', { providerBps: 8500 });
    await put('platformLedger/x', { thikano: 100 });
    await put('auditLogs/a1', { action: 'room.published' });
    await put('users/resA', { uid: 'resA', displayName: 'Rohit', createdAt: T, activeStay: { orgId: 'orgA', propertyId: 'propA1', residentId: 'res-a' } });
  });
});

const db = (uid: string | null, claims: Record<string, unknown> = {}): Firestore =>
  (uid ? env.authenticatedContext(uid, claims) : env.unauthenticatedContext()).firestore() as unknown as Firestore;
const stayA = { stay: { o: 'orgA', p: 'propA1', r: 'res-a' } };
const stayB = { stay: { o: 'orgA', p: 'propA1', r: 'res-b' } };
const owner = () => db('ownerA');
const residentA = () => db('resA', stayA);
const residentB = () => db('resB', stayB);
const admin = () => db('admin1', { platformRole: 'platform_admin' });
const support = () => db('support1', { platformRole: 'platform_support' });

describe('resident isolation', () => {
  it('Resident A can read their own resident record and invoice', async () => {
    await assertSucceeds(getDoc(doc(residentA(), 'organizations/orgA/residents/res-a')));
    await assertSucceeds(getDoc(doc(residentA(), 'organizations/orgA/invoices/inv-a')));
    await assertSucceeds(getDoc(doc(residentA(), 'organizations/orgA/maintenance/m-a')));
  });

  it('Resident A cannot read Resident B', async () => {
    await assertFails(getDoc(doc(residentA(), 'organizations/orgA/residents/res-b')));
    await assertFails(getDoc(doc(residentA(), 'organizations/orgA/invoices/inv-b')));
  });

  it('Resident cannot list all invoices (query must be scoped to self)', async () => {
    await assertFails(getDocs(collection(residentA(), 'organizations/orgA/invoices')));
    await assertSucceeds(getDocs(query(collection(residentA(), 'organizations/orgA/invoices'), where('residentUid', '==', 'resA'))));
  });

  it('Resident cannot access owner data: members, leads, ledger, property inventory', async () => {
    await assertFails(getDocs(collection(residentA(), 'organizations/orgA/members')));
    await assertFails(getDoc(doc(residentA(), 'organizations/orgA/leads/lead1')));
    await assertFails(getDoc(doc(residentA(), 'organizations/orgA/ledger/l1')));
    await assertFails(getDoc(doc(residentA(), 'organizations/orgA/properties/propA1')));
    await assertFails(getDoc(doc(residentA(), 'organizations/orgA')));
  });

  it('Resident sees published notices of their property only', async () => {
    await assertSucceeds(getDoc(doc(residentA(), 'organizations/orgA/notices/n1')));
    await assertFails(getDoc(doc(residentA(), 'organizations/orgA/notices/n-draft')));
    await assertFails(getDoc(doc(db('resX', { stay: { o: 'orgB', p: 'propB1', r: 'res-x' } }), 'organizations/orgA/notices/n1')));
  });

  it('Resident cannot write their own rent, residency or activeStay', async () => {
    await assertFails(updateDoc(doc(residentA(), 'organizations/orgA/invoices/inv-a'), { paid: 950000 }));
    await assertFails(updateDoc(doc(residentA(), 'organizations/orgA/residents/res-a'), { rent: 1 }));
    await assertFails(updateDoc(doc(residentA(), 'users/resA'), { activeStay: null }));
    await assertSucceeds(updateDoc(doc(residentA(), 'users/resA'), { displayName: 'Rohit S', updatedAt: T }));
  });
});

describe('tenant isolation between owners', () => {
  it('Owner A can read their org data', async () => {
    await assertSucceeds(getDoc(doc(owner(), 'organizations/orgA/properties/propA1')));
    await assertSucceeds(getDoc(doc(owner(), 'organizations/orgA/residents/res-a')));
    await assertSucceeds(getDoc(doc(owner(), 'organizations/orgA/ledger/l1')));
  });

  it('Owner A cannot read or write Owner B', async () => {
    await assertFails(getDoc(doc(owner(), 'organizations/orgB')));
    await assertFails(getDoc(doc(owner(), 'organizations/orgB/properties/propB1')));
    await assertFails(getDoc(doc(owner(), 'organizations/orgB/residents/res-x')));
    await assertFails(setDoc(doc(owner(), 'organizations/orgB/properties/propB1/rooms/x'), { id: 'x', orgId: 'orgB', propertyId: 'propB1' }));
    await assertFails(getDocs(collection(owner(), 'organizations/orgB/members')));
  });

  it('A user cannot make themselves a member of another org', async () => {
    await assertFails(setDoc(doc(owner(), 'organizations/orgB/members/ownerA'), { uid: 'ownerA', role: 'owner', propertyIds: null, status: 'active' }));
  });

  it('Removed members lose access', async () => {
    await assertFails(getDoc(doc(db('exStaff'), 'organizations/orgA/properties/propA1')));
  });
});

describe('property scoping and staff permissions', () => {
  it('Manager scoped to propA1 cannot see propA2', async () => {
    const m = db('mgrP1');
    await assertSucceeds(getDoc(doc(m, 'organizations/orgA/properties/propA1/rooms/r1')));
    await assertFails(getDoc(doc(m, 'organizations/orgA/properties/propA2/rooms/r1')));
    await assertSucceeds(getDoc(doc(m, 'organizations/orgA/leads/lead1')));
    await assertFails(getDoc(doc(m, 'organizations/orgA/leads/lead2')));
  });

  it('Maintenance staff cannot read rent, leads or earnings', async () => {
    const s = db('staffMaint');
    await assertSucceeds(getDoc(doc(s, 'organizations/orgA/maintenance/m-a')));
    await assertSucceeds(updateDoc(doc(s, 'organizations/orgA/maintenance/m-a'), { status: 'assigned', assigneeUid: 'staffMaint', updatedAt: T }));
    await assertFails(getDoc(doc(s, 'organizations/orgA/invoices/inv-a')));
    await assertFails(getDoc(doc(s, 'organizations/orgA/leads/lead1')));
    await assertFails(getDoc(doc(s, 'organizations/orgA/ledger/l1')));
    await assertFails(updateDoc(doc(s, 'organizations/orgA/properties/propA1/rooms/r1'), { rent: 1 }));
  });

  it('Staff cannot change maintenance fields other than status/assignee', async () => {
    await assertFails(updateDoc(doc(db('staffMaint'), 'organizations/orgA/maintenance/m-a'), { residentUid: 'someoneElse' }));
  });
});

describe('server-only invariants', () => {
  it('Nobody can mark a bed occupied from the client (availability cannot be faked)', async () => {
    await assertFails(updateDoc(doc(owner(), 'organizations/orgA/properties/propA1/beds/b1'), { status: 'occupied', updatedAt: T }));
    await assertFails(updateDoc(doc(owner(), 'organizations/orgA/properties/propA1/beds/b2'), { status: 'available', updatedAt: T }));
    await assertSucceeds(updateDoc(doc(owner(), 'organizations/orgA/properties/propA1/beds/b1'), { status: 'blocked', updatedAt: T }));
  });

  it('Room inventory, stats, slug and listing intent are server-only', async () => {
    const ref = doc(owner(), 'organizations/orgA/properties/propA1/rooms/r1');
    await assertFails(updateDoc(ref, { 'inventory.availableBeds': 5 }));
    await assertFails(updateDoc(ref, { 'stats.views': 9999 }));
    await assertFails(updateDoc(ref, { publicSlug: 'hijack' }));
    await assertSucceeds(updateDoc(ref, { rent: 990000, updatedAt: T }));
    // Listing goes through the audited setRoomListing callable.
    await assertFails(updateDoc(ref, { listingIntent: 'listed', updatedAt: T }));
  });

  it('Rooms must be created unlisted, without derived fields, with valid money', async () => {
    const base = { id: 'r9', orgId: 'orgA', propertyId: 'propA1', number: '901', sharing: 'double', rent: 900000, deposit: 900000, listingIntent: 'unlisted', createdBy: 'ownerA', createdAt: T, updatedAt: T };
    const ref = doc(owner(), 'organizations/orgA/properties/propA1/rooms/r9');
    await assertFails(setDoc(ref, { ...base, inventory: { availableBeds: 99 } }));
    await assertFails(setDoc(ref, { ...base, rent: -5 }));
    await assertFails(setDoc(ref, { ...base, rent: 9500.5 }));
    await assertSucceeds(setDoc(ref, base));
  });

  it('Property verification cannot be self-approved', async () => {
    // propA1 is seeded 'verified'; owners can't change it either way.
    await assertFails(updateDoc(doc(owner(), 'organizations/orgA/properties/propA1'), { verification: 'submitted' }));
    await assertFails(updateDoc(doc(owner(), 'organizations/orgA/properties/propNew0'), { verification: 'verified' }));
    await assertFails(setDoc(doc(owner(), 'organizations/orgA/properties/propNew'), { id: 'propNew', orgId: 'orgA', verification: 'verified', createdBy: 'ownerA', createdAt: T, updatedAt: T }));
    await assertSucceeds(setDoc(doc(owner(), 'organizations/orgA/properties/propNew'), { id: 'propNew', orgId: 'orgA', verification: 'draft', createdBy: 'ownerA', createdAt: T, updatedAt: T }));
  });

  it('Scoped managers cannot create new properties', async () => {
    await assertFails(setDoc(doc(db('mgrP1'), 'organizations/orgA/properties/propX'), { id: 'propX', orgId: 'orgA', verification: 'draft', createdBy: 'mgrP1', createdAt: T, updatedAt: T }));
  });

  it('Leads, residents, payments and audit logs cannot be written by clients', async () => {
    await assertFails(setDoc(doc(db(null), 'organizations/orgA/leads/spam'), { name: 'x' }));
    await assertFails(setDoc(doc(owner(), 'organizations/orgA/leads/fake'), { name: 'x', propertyId: 'propA1' }));
    await assertFails(setDoc(doc(owner(), 'organizations/orgA/residents/r-new'), { propertyId: 'propA1' }));
    await assertFails(setDoc(doc(owner(), 'organizations/orgA/payments/p1'), { propertyId: 'propA1', amount: 1 }));
    await assertFails(setDoc(doc(admin(), 'auditLogs/forged'), { action: 'x' }));
    await assertFails(deleteDoc(doc(admin(), 'auditLogs/a1')));
  });

  it('Owner can only update lead status (not contact details)', async () => {
    await assertSucceeds(updateDoc(doc(owner(), 'organizations/orgA/leads/lead1'), { status: 'contacted', updatedAt: T }));
    await assertFails(updateDoc(doc(owner(), 'organizations/orgA/leads/lead1'), { phone: '+910000000000' }));
  });
});

describe('public and platform access', () => {
  it('Unauthenticated users can read public projections only', async () => {
    await assertSucceeds(getDoc(doc(db(null), 'publicRooms/r1')));
    await assertSucceeds(getDoc(doc(db(null), 'publicProperties/propA1')));
    await assertFails(getDoc(doc(db(null), 'organizations/orgA/properties/propA1/rooms/r1')));
    await assertFails(getDoc(doc(db(null), 'organizations/orgA/residents/res-a')));
    await assertFails(setDoc(doc(db(null), 'publicRooms/r1'), { rent: 1 }));
    await assertFails(setDoc(doc(owner(), 'publicRooms/r1'), { availableBeds: 99 }));
  });

  it('Platform admin can read across tenants and internal economics', async () => {
    await assertSucceeds(getDoc(doc(admin(), 'organizations/orgB/properties/propB1')));
    await assertSucceeds(getDoc(doc(admin(), 'revenueRules/default')));
    await assertSucceeds(getDoc(doc(admin(), 'platformLedger/x')));
    await assertSucceeds(getDoc(doc(admin(), 'auditLogs/a1')));
  });

  it('Platform support cannot read internal economics', async () => {
    await assertSucceeds(getDoc(doc(support(), 'organizations/orgA/leads/lead1')));
    await assertFails(getDoc(doc(support(), 'revenueRules/default')));
    await assertFails(getDoc(doc(support(), 'platformLedger/x')));
    await assertFails(getDoc(doc(support(), 'organizations/orgA/ledger/l1')));
  });

  it('Owners cannot read revenue rules or platform ledger', async () => {
    await assertFails(getDoc(doc(owner(), 'revenueRules/default')));
    await assertFails(getDoc(doc(owner(), 'platformLedger/x')));
  });

  it('Users cannot grant themselves a platform role via profile', async () => {
    await assertFails(setDoc(doc(db('newbie'), 'users/newbie'), { uid: 'newbie', displayName: 'x', createdAt: T, platformRole: 'platform_admin' }));
    await assertSucceeds(setDoc(doc(db('newbie'), 'users/newbie'), { uid: 'newbie', displayName: 'x', createdAt: T }));
  });
});
