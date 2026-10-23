import './app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  can,
  deriveInvoiceStatus,
  deriveListingStatus,
  isEligibleForOneClickListing,
  outstanding,
  partnerEarningsByCategory,
  type Bed,
  type Booking,
  type Building,
  type Floor,
  type Lead,
  type ListingStatus,
  type MaintenanceIssue,
  type Notice,
  type OrgMember,
  type Payment,
  type Property,
  type RentInvoice,
  type Resident,
  type Room,
  type ServiceCategory,
  type StaffPermission,
} from '@thikano/domain';
import type { OwnerSession } from './session';

/**
 * Owner-console repositories (server-only, Admin SDK). Every function re-checks the
 * caller's permission for the property — the same matrix as firestore.rules.
 */
const db = () => getFirestore();
const col = (s: OwnerSession, name: string) => db().collection(`organizations/${s.orgId}/${name}`);
const propCol = (s: OwnerSession, propertyId: string, name: string) => db().collection(`organizations/${s.orgId}/properties/${propertyId}/${name}`);

export class AccessDenied extends Error {
  constructor() {
    super('access-denied');
  }
}

function assertCan(s: OwnerSession, perm: StaffPermission, propertyId?: string) {
  if (!can(s.member, perm, propertyId)) throw new AccessDenied();
}

export function istPeriod(t = Date.now()): string {
  return new Date(t + 330 * 60_000).toISOString().slice(0, 7);
}

export async function listProperties(s: OwnerSession): Promise<Property[]> {
  const snap = await col(s, 'properties').get();
  return snap.docs.map((d) => d.data() as Property).filter((p) => can(s.member, 'inventory.read', p.id)).sort((a, b) => a.createdAt - b.createdAt);
}

export async function getProperty(s: OwnerSession, propertyId: string): Promise<Property | null> {
  assertCan(s, 'inventory.read', propertyId);
  const snap = await db().doc(`organizations/${s.orgId}/properties/${propertyId}`).get();
  return snap.exists ? (snap.data() as Property) : null;
}

export interface RoomRow {
  room: Room;
  listingStatus: ListingStatus;
  building: Building | null;
  floor: Floor | null;
  beds: Bed[];
}

export async function getRooms(s: OwnerSession, property: Property): Promise<RoomRow[]> {
  assertCan(s, 'inventory.read', property.id);
  const [rooms, beds, buildings, floors] = await Promise.all([
    propCol(s, property.id, 'rooms').get(),
    propCol(s, property.id, 'beds').get(),
    propCol(s, property.id, 'buildings').get(),
    propCol(s, property.id, 'floors').get(),
  ]);
  const b = new Map(buildings.docs.map((d) => [d.id, d.data() as Building]));
  const f = new Map(floors.docs.map((d) => [d.id, d.data() as Floor]));
  const bedsByRoom = new Map<string, Bed[]>();
  for (const d of beds.docs) {
    const bed = d.data() as Bed;
    bedsByRoom.set(bed.roomId, [...(bedsByRoom.get(bed.roomId) ?? []), bed]);
  }
  return rooms.docs
    .map((d) => d.data() as Room)
    .filter((r) => r.listingIntent !== 'archived')
    .map((room) => ({
      room,
      listingStatus: room.inventory
        ? deriveListingStatus({ intent: room.listingIntent, propertyVerification: property.verification, operationalStatus: room.operationalStatus, inventory: room.inventory, adminSuspended: (room as Room & { adminSuspended?: boolean }).adminSuspended })
        : ('draft' as ListingStatus),
      building: b.get(room.buildingId) ?? null,
      floor: f.get(room.floorId) ?? null,
      beds: (bedsByRoom.get(room.id) ?? []).sort((x, y) => x.label.localeCompare(y.label)),
    }))
    .sort((x, y) => (x.building?.sortOrder ?? 0) - (y.building?.sortOrder ?? 0) || (x.floor?.level ?? 0) - (y.floor?.level ?? 0) || x.room.number.localeCompare(y.room.number, 'en', { numeric: true }));
}

export async function getStructure(s: OwnerSession, propertyId: string) {
  assertCan(s, 'inventory.read', propertyId);
  const [buildings, floors] = await Promise.all([propCol(s, propertyId, 'buildings').get(), propCol(s, propertyId, 'floors').get()]);
  return {
    buildings: buildings.docs.map((d) => d.data() as Building).sort((a, b) => a.sortOrder - b.sortOrder),
    floors: floors.docs.map((d) => d.data() as Floor).sort((a, b) => a.level - b.level),
  };
}

export async function getRoomDetail(s: OwnerSession, property: Property, roomId: string) {
  const rows = await getRooms(s, property);
  const row = rows.find((r) => r.room.id === roomId);
  if (!row) return null;
  const residentIds = row.beds.map((b) => b.residentId).filter((x): x is string => !!x);
  const residents = can(s.member, 'residents.read', property.id) && residentIds.length ? await db().getAll(...residentIds.map((id) => col(s, 'residents').doc(id))) : [];
  const byId = new Map(residents.filter((d) => d.exists).map((d) => [d.id, d.data() as Resident]));
  return { ...row, occupants: Object.fromEntries(row.beds.map((b) => [b.id, b.residentId ? byId.get(b.residentId) ?? null : null])) };
}

export async function getResidents(s: OwnerSession, propertyId: string) {
  assertCan(s, 'residents.read', propertyId);
  const [res, rooms] = await Promise.all([
    col(s, 'residents').where('propertyId', '==', propertyId).where('status', 'in', ['active', 'notice', 'invited']).get(),
    propCol(s, propertyId, 'rooms').get(),
  ]);
  const roomById = new Map(rooms.docs.map((d) => [d.id, d.data() as Room]));
  return res.docs
    .map((d) => d.data() as Resident)
    .map((r) => ({ resident: r, room: roomById.get(r.roomId) ?? null }))
    .sort((a, b) => (a.room?.number ?? '').localeCompare(b.room?.number ?? '', 'en', { numeric: true }));
}

export async function getInvoices(s: OwnerSession, propertyId: string, period: string) {
  assertCan(s, 'rent.read', propertyId);
  const [inv, residents, payments] = await Promise.all([
    col(s, 'invoices').where('propertyId', '==', propertyId).where('period', '==', period).get(),
    col(s, 'residents').where('propertyId', '==', propertyId).get(),
    col(s, 'payments').where('propertyId', '==', propertyId).orderBy('createdAt', 'desc').limit(20).get(),
  ]);
  const resById = new Map(residents.docs.map((d) => [d.id, d.data() as Resident]));
  const t = Date.now();
  const rows = inv.docs.map((d) => {
    const i = d.data() as RentInvoice;
    return { invoice: i, status: deriveInvoiceStatus(i, t), due: outstanding(i), resident: resById.get(i.residentId) ?? null };
  });
  const order = { overdue: 0, partially_paid: 1, due: 2, upcoming: 3, paid: 4 } as const;
  rows.sort((a, b) => order[a.status] - order[b.status] || b.due - a.due);
  return {
    rows,
    collected: rows.reduce((a, r) => a + r.invoice.paid, 0),
    outstanding: rows.reduce((a, r) => a + r.due, 0),
    billed: rows.reduce((a, r) => a + r.invoice.amount + r.invoice.lateFee, 0),
    recentPayments: payments.docs.map((d) => ({ payment: d.data() as Payment, resident: resById.get((d.data() as Payment).residentId) ?? null })),
  };
}

export async function getMaintenance(s: OwnerSession, propertyId: string) {
  assertCan(s, 'maintenance.read', propertyId);
  const [issues, rooms] = await Promise.all([col(s, 'maintenance').where('propertyId', '==', propertyId).orderBy('createdAt', 'desc').limit(200).get(), propCol(s, propertyId, 'rooms').get()]);
  const roomById = new Map(rooms.docs.map((d) => [d.id, d.data() as Room]));
  return issues.docs.map((d) => ({ issue: d.data() as MaintenanceIssue, room: roomById.get((d.data() as MaintenanceIssue).roomId) ?? null }));
}

export async function getNotices(s: OwnerSession, propertyId: string) {
  assertCan(s, 'inventory.read', propertyId);
  const snap = await col(s, 'notices').where('propertyId', '==', propertyId).orderBy('createdAt', 'desc').limit(50).get();
  return snap.docs.map((d) => d.data() as Notice);
}

export async function getLeads(s: OwnerSession, propertyId: string) {
  assertCan(s, 'leads.read', propertyId);
  const [leads, bookings, rooms] = await Promise.all([
    col(s, 'leads').where('propertyId', '==', propertyId).orderBy('createdAt', 'desc').limit(200).get(),
    col(s, 'bookings').where('propertyId', '==', propertyId).get(),
    propCol(s, propertyId, 'rooms').get(),
  ]);
  const bookingById = new Map(bookings.docs.map((d) => [d.id, d.data() as Booking]));
  const roomById = new Map(rooms.docs.map((d) => [d.id, d.data() as Room]));
  return leads.docs.map((d) => {
    const lead = d.data() as Lead;
    return { lead, booking: lead.bookingId ? bookingById.get(lead.bookingId) ?? null : null, room: lead.roomId ? roomById.get(lead.roomId) ?? null : null };
  });
}

export async function getTeam(s: OwnerSession) {
  const snap = await col(s, 'members').get();
  return snap.docs.map((d) => d.data() as OrgMember).filter((m) => m.status !== 'removed');
}

export async function getEarnings(s: OwnerSession, propertyId: string, period = istPeriod()) {
  assertCan(s, 'earnings.read', propertyId);
  const snap = await col(s, 'ledger').where('propertyId', '==', propertyId).where('period', '==', period).get();
  return { period, orders: snap.size, ...partnerEarningsByCategory(snap.docs.map((d) => ({ category: d.get('category') as ServiceCategory, partner: d.get('partner') as number }))) };
}

/** "What is happening in my PG today?" */
export async function getDashboard(s: OwnerSession, property: Property) {
  const propertyId = property.id;
  const rooms = await getRooms(s, property);
  const beds = rooms.flatMap((r) => r.beds);
  const roomById = new Map(rooms.map((r) => [r.room.id, r.room]));
  const vacant = beds.filter((b) => b.status === 'available' && roomById.get(b.roomId)?.operationalStatus === 'active');
  const vacantRevenue = vacant.reduce((a, b) => a + (b.rentOverride ?? roomById.get(b.roomId)!.rent), 0);
  const eligibleToList = rooms.filter((r) => r.room.inventory && isEligibleForOneClickListing({ intent: r.room.listingIntent, propertyVerification: property.verification, operationalStatus: r.room.operationalStatus, inventory: r.room.inventory })).map((r) => r.room);

  const rent = can(s.member, 'rent.read', propertyId) ? await getInvoices(s, propertyId, istPeriod()) : null;
  const issues = can(s.member, 'maintenance.read', propertyId) ? (await getMaintenance(s, propertyId)).filter((m) => m.issue.status !== 'resolved' && m.issue.status !== 'cancelled') : [];
  const leads = can(s.member, 'leads.read', propertyId) ? (await getLeads(s, propertyId)).filter((l) => l.lead.status === 'new') : [];
  const residents = can(s.member, 'residents.read', propertyId) ? await getResidents(s, propertyId) : [];
  const earnings = can(s.member, 'earnings.read', propertyId) ? await getEarnings(s, propertyId) : null;

  return {
    totalBeds: beds.length,
    occupied: beds.filter((b) => b.status === 'occupied').length,
    vacantBeds: vacant.length,
    vacantRevenue,
    rent,
    overdue: rent ? rent.rows.filter((r) => r.status === 'overdue') : [],
    openIssues: issues,
    newLeads: leads,
    leaving: residents.filter((r) => r.resident.status === 'notice'),
    earnings,
    eligibleToList,
    vacantRooms: rooms.filter((r) => r.room.inventory?.availableBeds > 0 && r.room.operationalStatus === 'active'),
  };
}
