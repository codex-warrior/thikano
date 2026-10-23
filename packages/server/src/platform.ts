import './app';
import { getFirestore } from 'firebase-admin/firestore';
import { summarizeProperty, type Bed, type Booking, type Lead, type OrgMember, type Organization, type Property, type Resident, type RevenueShareRule, type Room } from '@thikano/domain';
import type { PlatformSession } from './session';

/**
 * Platform (Admin) repositories. Callers must hold a platform role; economics require
 * platform_admin. Support staff see masked phone numbers.
 */
const db = () => getFirestore();

export class PlatformAccessDenied extends Error {}

function requireStaff(s: PlatformSession | null): asserts s is PlatformSession {
  if (!s) throw new PlatformAccessDenied('platform-access-denied');
}
function requireAdmin(s: PlatformSession | null): asserts s is PlatformSession {
  if (!s || s.role !== 'platform_admin') throw new PlatformAccessDenied('platform-admin-required');
}

export function maskPhone(phone: string | null | undefined, s: PlatformSession): string {
  if (!phone) return '—';
  if (s.role === 'platform_admin') return phone;
  return phone.replace(/^(\+\d{2})(\d{2})\d{5}(\d{3})$/, '$1 $2•••••$3');
}

const monthStart = () => {
  const ist = new Date(Date.now() + 330 * 60_000);
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 330 * 60_000;
};

async function count(q: FirebaseFirestore.Query) {
  return (await q.count().get()).data().count;
}

export async function getPlatformMetrics(s: PlatformSession | null) {
  requireStaff(s);
  const ms = monthStart();
  const [properties, verified, pending, owners, residents, availableBeds, leadsThisMonth, bookingsThisMonth] = await Promise.all([
    count(db().collectionGroup('properties')),
    count(db().collectionGroup('properties').where('verification', '==', 'verified')),
    count(db().collectionGroup('properties').where('verification', '==', 'submitted')),
    count(db().collection('organizations')),
    count(db().collectionGroup('residents').where('status', 'in', ['active', 'notice'])),
    db().collection('publicRooms').where('listingStatus', '==', 'published').select('availableBeds').get().then((q) => q.docs.reduce((a, d) => a + ((d.get('availableBeds') as number) ?? 0), 0)),
    count(db().collectionGroup('leads').where('createdAt', '>=', ms)),
    count(db().collectionGroup('bookings').where('stage', 'in', ['booked', 'moved_in']).where('updatedAt', '>=', ms)),
  ]);
  let serviceGmv: number | null = null;
  let thikanoRevenue: number | null = null;
  if (s.role === 'platform_admin') {
    const period = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 7);
    const ledger = await db().collection('platformLedger').where('period', '==', period).select('gross', 'thikano').get();
    serviceGmv = ledger.docs.reduce((a, d) => a + (d.get('gross') as number), 0);
    thikanoRevenue = ledger.docs.reduce((a, d) => a + (d.get('thikano') as number), 0);
  }
  const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const searchesToday = ((await db().doc(`analyticsDaily/platform_${day}`).get()).get('searches') as number | undefined) ?? 0;
  const searchSessions = await db().collection('searchEvents').where('at', '>=', Date.now() - 7 * 86_400_000).select('sessionId').limit(5000).get();
  const studentsSearching = new Set(searchSessions.docs.map((d) => (d.get('sessionId') as string) ?? d.id)).size;
  return { properties, verified, pending, owners, residents, availableBeds, leadsThisMonth, bookingsThisMonth, serviceGmv, thikanoRevenue, searchesToday, studentsSearching };
}

export async function getPropertiesOverview(s: PlatformSession | null) {
  requireStaff(s);
  const [props, orgs, beds, leads] = await Promise.all([
    db().collectionGroup('properties').limit(500).get(),
    db().collection('organizations').get(),
    db().collectionGroup('beds').select('propertyId', 'status', 'roomId', 'rentOverride').limit(20000).get(),
    db().collectionGroup('leads').select('propertyId').limit(20000).get(),
  ]);
  const orgById = new Map(orgs.docs.map((d) => [d.id, d.data() as Organization]));
  const owners = new Map<string, string>();
  for (const o of orgs.docs) {
    const m = await db().doc(`organizations/${o.id}/members/${o.get('ownerUid')}`).get();
    owners.set(o.id, (m.get('displayName') as string) ?? '—');
  }
  const bedsByProp = new Map<string, Pick<Bed, 'status' | 'rentOverride' | 'moveOutDate'>[]>();
  for (const b of beds.docs) bedsByProp.set(b.get('propertyId'), [...(bedsByProp.get(b.get('propertyId')) ?? []), { status: b.get('status'), rentOverride: b.get('rentOverride') ?? null, moveOutDate: null }]);
  const leadCount = new Map<string, number>();
  for (const l of leads.docs) leadCount.set(l.get('propertyId'), (leadCount.get(l.get('propertyId')) ?? 0) + 1);
  return props.docs.map((d) => {
    const p = d.data() as Property;
    const summary = summarizeProperty([{ rent: 0, operationalStatus: 'active', beds: bedsByProp.get(p.id) ?? [] }]);
    return { property: p, orgName: orgById.get(p.orgId)?.name ?? '—', ownerName: owners.get(p.orgId) ?? '—', summary, leads: leadCount.get(p.id) ?? 0 };
  });
}

export async function getVerificationQueue(s: PlatformSession | null) {
  requireStaff(s);
  const reqs = await db().collection('verificationRequests').where('status', '==', 'pending').limit(50).get();
  const out = [];
  for (const r of reqs.docs) {
    const { orgId, propertyId, submittedAt } = r.data() as { orgId: string; propertyId: string; submittedAt: number };
    const [pSnap, rooms, beds, org] = await Promise.all([
      db().doc(`organizations/${orgId}/properties/${propertyId}`).get(),
      db().collection(`organizations/${orgId}/properties/${propertyId}/rooms`).get(),
      db().collection(`organizations/${orgId}/properties/${propertyId}/beds`).select('status').get(),
      db().doc(`organizations/${orgId}`).get(),
    ]);
    if (!pSnap.exists) continue;
    const p = pSnap.data() as Property;
    const owner = await db().doc(`organizations/${orgId}/members/${org.get('ownerUid')}`).get();
    const roomList = rooms.docs.map((d) => d.data() as Room);
    out.push({
      property: p,
      orgId,
      ownerName: (owner.get('displayName') as string) ?? '—',
      submittedAt,
      rooms: roomList.length,
      beds: beds.size,
      startingRent: roomList.length ? Math.min(...roomList.map((x) => x.rent)) : null,
      checklist: [
        { label: 'Owner information', ok: owner.exists },
        { label: 'Address', ok: !!p.address?.line1 && !!p.address?.pincode },
        { label: `Photos (${p.photos?.length ?? 0})`, ok: (p.photos?.length ?? 0) >= 1 },
        { label: 'Property details & amenities', ok: (p.description?.length ?? 0) > 20 && (p.amenities?.length ?? 0) > 0 },
        { label: `Inventory (${roomList.length} rooms, ${beds.size} beds)`, ok: roomList.length > 0 && beds.size > 0 },
        { label: 'Rules', ok: (p.rules?.length ?? 0) > 0 },
      ],
    });
  }
  return out.sort((a, b) => a.submittedAt - b.submittedAt);
}

export async function getOwners(s: PlatformSession | null) {
  requireStaff(s);
  const [orgs, props] = await Promise.all([db().collection('organizations').get(), getPropertiesOverview(s)]);
  const out = [];
  for (const o of orgs.docs) {
    const org = o.data() as Organization;
    const owner = (await db().doc(`organizations/${o.id}/members/${org.ownerUid}`).get()).data() as OrgMember | undefined;
    const mine = props.filter((p) => p.property.orgId === o.id);
    out.push({
      org,
      ownerName: owner?.displayName ?? '—',
      properties: mine.length,
      residents: mine.reduce((a, p) => a + p.summary.occupiedBeds, 0),
      vacancies: mine.reduce((a, p) => a + p.summary.availableBeds, 0),
    });
  }
  return out.sort((a, b) => a.org.createdAt - b.org.createdAt);
}

export async function getLeadsAcrossPlatform(s: PlatformSession | null, limit = 100) {
  requireStaff(s);
  const snap = await db().collectionGroup('leads').orderBy('createdAt', 'desc').limit(limit).get();
  const names = new Map<string, string>();
  const rows = [];
  for (const d of snap.docs) {
    const l = d.data() as Lead;
    if (!names.has(l.propertyId)) names.set(l.propertyId, ((await db().doc(`organizations/${l.orgId}/properties/${l.propertyId}`).get()).get('name') as string) ?? '—');
    rows.push({ lead: { ...l, phone: maskPhone(l.phone, s) }, propertyName: names.get(l.propertyId)! });
  }
  return rows;
}

export async function getBookingsAcrossPlatform(s: PlatformSession | null, limit = 100) {
  requireStaff(s);
  const snap = await db().collectionGroup('bookings').orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data() as Booking);
}

export async function getResidentsAcrossPlatform(s: PlatformSession | null, limit = 200) {
  requireStaff(s);
  const snap = await db().collectionGroup('residents').where('status', 'in', ['active', 'notice']).limit(limit).get();
  return snap.docs.map((d) => {
    const r = d.data() as Resident;
    return { ...r, phone: maskPhone(r.phone, s) };
  });
}

export async function getEconomics(s: PlatformSession | null) {
  requireAdmin(s);
  const [providers, rules, ledger] = await Promise.all([
    db().collection('providers').get(),
    db().collection('revenueRules').get(),
    db().collection('platformLedger').orderBy('createdAt', 'desc').limit(100).get(),
  ]);
  return {
    providers: providers.docs.map((d) => d.data() as { id: string; name: string; status: string; adapter: string; categories: string[] }),
    rules: rules.docs.map((d) => d.data() as RevenueShareRule),
    ledger: ledger.docs.map((d) => d.data() as { orderId: string; category: string; providerId: string; gross: number; provider: number; thikano: number; partner: number; otherFees: number; createdAt: number; propertyId: string }),
  };
}

export async function getAuditLogs(s: PlatformSession | null, limit = 150) {
  requireStaff(s);
  const snap = await db().collection('auditLogs').orderBy('at', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data() as { id: string; actorUid: string; actorRole: string; action: string; entity: string; entityId: string; orgId: string | null; at: number; metadata: Record<string, unknown> });
}

export async function getSupportQueues(s: PlatformSession | null) {
  requireStaff(s);
  const [tickets, disputes, reviews] = await Promise.all([
    db().collection('supportTickets').orderBy('createdAt', 'desc').limit(50).get(),
    db().collection('disputes').orderBy('createdAt', 'desc').limit(50).get(),
    db().collection('reviews').orderBy('createdAt', 'desc').limit(50).get(),
  ]);
  return { tickets: tickets.docs.map((d) => d.data()), disputes: disputes.docs.map((d) => d.data()), reviews: reviews.docs.map((d) => d.data()) };
}

export async function getListedRooms(s: PlatformSession | null, limit = 200) {
  requireStaff(s);
  const snap = await db().collectionGroup('rooms').where('listingIntent', '==', 'listed').limit(limit).get();
  const props = new Map<string, string>();
  const rows = [];
  for (const d of snap.docs) {
    const r = d.data() as Room & { adminSuspended?: boolean };
    if (!props.has(r.propertyId)) props.set(r.propertyId, ((await db().doc(`organizations/${r.orgId}/properties/${r.propertyId}`).get()).get('name') as string) ?? '—');
    rows.push({ room: r, propertyName: props.get(r.propertyId)!, suspended: r.adminSuspended === true });
  }
  return rows.sort((a, b) => a.propertyName.localeCompare(b.propertyName) || a.room.number.localeCompare(b.room.number, 'en', { numeric: true }));
}

/** Students = people searching/enquiring who are not residents. Aggregates only (privacy). */
export async function getStudentsOverview(s: PlatformSession | null) {
  requireStaff(s);
  const since = Date.now() - 30 * 86_400_000;
  const [searches, leads, bookings] = await Promise.all([
    db().collection('searchEvents').where('at', '>=', since).limit(5000).get(),
    count(db().collectionGroup('leads').where('createdAt', '>=', since)),
    count(db().collectionGroup('bookings').where('updatedAt', '>=', since)),
  ]);
  const areas = new Map<string, number>();
  const colleges = new Map<string, number>();
  const budgets = new Map<string, number>();
  const sessions = new Set<string>();
  for (const d of searches.docs) {
    const e = d.data() as { area?: string | null; college?: string | null; maxRent?: number | null; sessionId?: string | null };
    sessions.add(e.sessionId ?? d.id);
    if (e.area) areas.set(e.area, (areas.get(e.area) ?? 0) + 1);
    if (e.college) colleges.set(e.college, (colleges.get(e.college) ?? 0) + 1);
    const bucket = e.maxRent == null ? 'Any' : e.maxRent <= 800_000 ? 'Up to ₹8k' : e.maxRent <= 1_000_000 ? '₹8k–₹10k' : e.maxRent <= 1_300_000 ? '₹10k–₹13k' : 'Above ₹13k';
    budgets.set(bucket, (budgets.get(bucket) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return { searches: searches.size, sessions: sessions.size, leads, bookings, topAreas: top(areas), topColleges: top(colleges), budgets: top(budgets) };
}

export async function getPlatformDaily(s: PlatformSession | null, days = 30) {
  requireStaff(s);
  const out: { day: string; searches: number; views: number; enquiries: number; shares: number; serviceOrders: number }[] = [];
  const refs = Array.from({ length: days }, (_, i) => new Date(Date.now() + 330 * 60_000 - i * 86_400_000).toISOString().slice(0, 10)).map((day) => db().doc(`analyticsDaily/platform_${day}`));
  const snaps = await db().getAll(...refs);
  for (const snap of snaps) {
    const d = snap.data() ?? {};
    out.push({ day: snap.id.replace('platform_', ''), searches: d.searches ?? 0, views: d.views ?? 0, enquiries: d.enquiries ?? 0, shares: d.shares ?? 0, serviceOrders: d.serviceOrders ?? 0 });
  }
  return out.reverse();
}
