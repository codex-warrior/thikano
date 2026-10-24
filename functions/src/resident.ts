import { onCall } from 'firebase-functions/v2/https';
import { deriveInvoiceStatus, outstanding, type Bed, type MaintenanceIssue, type Notice, type Parcel, type Property, type RentInvoice, type Resident, type Room, type ServiceOrder } from '@thikano/domain';
import { db, paths } from './lib/admin';
import { requireAuth } from './lib/authz';
import { notAllowed } from './lib/errors';

/**
 * Everything the Resident app needs in one authorized read ("Habistat Daily").
 * Residents may not read other residents or owner inventory directly — this function
 * returns only what belongs to them plus roommates' first names.
 */
export const getResidentHome = onCall(async (req) => {
  const caller = requireAuth(req);
  if (!caller.stay) return notAllowed();
  const { o: orgId, p: propertyId, r: residentId } = caller.stay;
  const resSnap = await db.doc(`${paths.orgCol(orgId, 'residents')}/${residentId}`).get();
  const res = resSnap.data() as Resident | undefined;
  if (!res || res.uid !== caller.uid || res.status === 'moved_out') return notAllowed();

  const now = Date.now();
  const [propSnap, roomSnap, bedSnap, roommates, invoices, notices, parcels, orders, issues] = await Promise.all([
    db.doc(paths.property(orgId, propertyId)).get(),
    db.doc(paths.room(orgId, propertyId, res.roomId)).get(),
    db.doc(paths.bed(orgId, propertyId, res.bedId)).get(),
    db.collection(paths.orgCol(orgId, 'residents')).where('roomId', '==', res.roomId).where('status', 'in', ['active', 'notice']).get(),
    db.collection(paths.orgCol(orgId, 'invoices')).where('residentId', '==', residentId).limit(24).get(),
    db.collection(paths.orgCol(orgId, 'notices')).where('propertyId', '==', propertyId).orderBy('createdAt', 'desc').limit(20).get(),
    db.collection(paths.orgCol(orgId, 'parcels')).where('residentId', '==', residentId).where('collectedAt', '==', null).limit(10).get(),
    db.collection(paths.orgCol(orgId, 'serviceOrders')).where('residentUid', '==', caller.uid).orderBy('createdAt', 'desc').limit(10).get(),
    db.collection(paths.orgCol(orgId, 'maintenance')).where('residentUid', '==', caller.uid).orderBy('createdAt', 'desc').limit(10).get(),
  ]);
  const property = propSnap.data() as Property;
  const room = roomSnap.data() as Room;
  const bed = bedSnap.data() as Bed;

  return {
    now,
    resident: { id: res.id, name: res.name, status: res.status, moveInDate: res.moveInDate, moveOutDate: res.moveOutDate ?? null, rent: res.rent, deposit: res.deposit, rentDueDay: res.rentDueDay },
    property: { id: property.id, name: property.name, locality: property.address.locality, city: property.address.city, rules: property.rules, amenities: property.amenities, foodIncluded: property.foodIncluded, contactPhone: property.publicContactPhone ?? null },
    room: { id: room.id, number: room.number, sharing: room.sharing, amenities: room.amenities, buildingId: room.buildingId },
    bed: { id: bed.id, label: bed.label },
    roommates: roommates.docs.map((d) => d.data() as Resident).filter((r) => r.id !== res.id).map((r) => r.name.split(' ')[0]),
    invoices: invoices.docs
      .map((d) => d.data() as RentInvoice)
      .map((i) => ({ id: i.id, period: i.period, amount: i.amount, lateFee: i.lateFee, paid: i.paid, dueDate: i.dueDate, status: deriveInvoiceStatus(i, now), outstanding: outstanding(i) }))
      .sort((a, b) => b.dueDate - a.dueDate),
    notices: notices.docs
      .map((d) => d.data() as Notice)
      .filter((n) => n.publishedAt && (n.buildingIds === null || n.buildingIds.includes(room.buildingId)))
      .map((n) => ({ id: n.id, title: n.title, body: n.body, startsAt: n.startsAt ?? null, endsAt: n.endsAt ?? null, publishedAt: n.publishedAt! })),
    parcels: parcels.docs.map((d) => d.data() as Parcel).map((p) => ({ id: p.id, carrier: p.carrier, location: p.location, arrivedAt: p.arrivedAt })),
    orders: orders.docs.map((d) => d.data() as ServiceOrder & { providerName?: string }).map((o) => ({ id: o.id, category: o.category, providerName: o.providerName ?? '', items: o.items, gross: o.gross, status: o.status, createdAt: o.createdAt, updatedAt: o.updatedAt })),
    issues: issues.docs.map((d) => d.data() as MaintenanceIssue).map((m) => ({ id: m.id, category: m.category, description: m.description, status: m.status, createdAt: m.createdAt, updatedAt: m.updatedAt })),
  };
});
