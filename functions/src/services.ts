import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { formatINR, splitForOrder, validateRule, type Paise, type Property, type Resident, type RevenueShareRule, type Room, type ServiceCategory, type ServiceOrder, type ServiceOrderStatus } from '@thikano/domain';
import { db, isEmulator, paths } from './lib/admin';
import { bump } from './lib/analytics';
import { audit } from './lib/audit';
import { requireAuth, requirePermission, requirePlatformAdmin } from './lib/authz';
import { badInput, fail, notAllowed, notFound } from './lib/errors';
import { notifyUsers } from './lib/notify';
import { id, obj, oneOf } from './lib/validate';
import { getProvider } from './providers';
import { periodOf } from './operations';

const CATEGORIES = ['food', 'laundry', 'cleaning', 'groceries', 'pharmacy', 'printing', 'courier', 'repairs', 'other'] as const satisfies readonly ServiceCategory[];
type Order = ServiceOrder & { residentUid: string; providerName: string };

/** Services a resident can order at their property. */
export const getServiceCatalog = onCall(async (req) => {
  const caller = requireAuth(req);
  if (!caller.stay) return notAllowed();
  const d = obj(req.data ?? {});
  const category = d.category ? oneOf(d, 'category', CATEGORIES) : undefined;
  const providers = await db.collection('providers').where('status', '==', 'active').get();
  const out: { providerId: string; providerName: string; items: unknown[] }[] = [];
  for (const p of providers.docs) {
    if (category && !(p.get('categories') as string[]).includes(category)) continue;
    try {
      const { doc, impl } = await getProvider(p.id);
      out.push({ providerId: p.id, providerName: doc.name, items: await impl.getServices({ propertyId: caller.stay.p, category }) });
    } catch {
      // A provider that isn't live is simply not offered.
    }
  }
  return { providers: out.filter((p) => p.items.length) };
});

/** Prices come from the provider catalog server-side — never from the client. */
export const placeServiceOrder = onCall(async (req) => {
  const caller = requireAuth(req);
  if (!caller.stay) return notAllowed();
  const d = obj(req.data);
  const providerId = id(d, 'providerId');
  const rawItems = Array.isArray(d.items) ? (d.items as unknown[]) : [];
  if (!rawItems.length || rawItems.length > 20) badInput('Please choose what you want to order.');
  const items = rawItems.map((x) => {
    const o = obj(x);
    const qty = typeof o.qty === 'number' && Number.isInteger(o.qty) && o.qty > 0 && o.qty <= 50 ? o.qty : badInput('Invalid quantity.');
    return { sku: id(o, 'sku'), qty };
  });
  const { o: orgId, p: propertyId, r: residentId } = caller.stay;
  const { doc: provider, impl } = await getProvider(providerId);
  const catalog = await impl.getServices({ propertyId });
  const bySku = new Map(catalog.map((c) => [c.sku, c]));
  const priced = items.map((i) => {
    const c = bySku.get(i.sku);
    if (!c || !c.available) return badInput('One of the items is no longer available.');
    return { sku: c.sku, name: c.name, qty: i.qty, unitPrice: c.price as Paise, category: c.category };
  });
  const category = priced[0]!.category;
  if (priced.some((p) => p.category !== category)) badInput('Please order one kind of service at a time.');
  const gross = priced.reduce((a, p) => a + p.unitPrice * p.qty, 0);

  const [res, property] = await Promise.all([
    db.doc(`${paths.orgCol(orgId, 'residents')}/${residentId}`).get().then((s) => s.data() as Resident | undefined),
    db.doc(paths.property(orgId, propertyId)).get().then((s) => s.data() as Property),
  ]);
  if (!res || res.uid !== caller.uid || res.status === 'moved_out') return notAllowed();
  const room = (await db.doc(paths.room(orgId, propertyId, res.roomId)).get()).data() as Room;

  const ref = db.collection(paths.orgCol(orgId, 'serviceOrders')).doc();
  const providerOrder = await impl.createOrder({
    orderId: ref.id, propertyId,
    deliverTo: { propertyName: property.name, locality: property.address.locality, city: property.address.city, room: room.number, residentName: res.name, phone: caller.phone },
    items: items,
  });
  const t = Date.now();
  const order: Order = {
    id: ref.id, orgId, propertyId, residentId, residentUid: caller.uid, providerId, providerName: provider.name, providerOrderRef: providerOrder.providerOrderRef,
    category, items: priced.map(({ category: _c, ...rest }) => rest), gross, status: providerOrder.status, createdAt: t, updatedAt: t, createdBy: caller.uid,
  };
  await ref.set(order);
  await bump(['platform', `property_${propertyId}`], { serviceOrders: 1 });
  return { orderId: ref.id, gross, status: order.status };
});

/** Partner/provider status update (partner console, webhook adapter, or emulator). */
export const updateServiceOrderStatus = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const orderId = id(d, 'orderId');
  const status = oneOf(d, 'status', ['accepted', 'in_progress', 'ready', 'delivered', 'cancelled', 'failed'] as const satisfies readonly ServiceOrderStatus[]);
  const ref = db.doc(`${paths.orgCol(orgId, 'serviceOrders')}/${orderId}`);
  const order = (await ref.get()).data() as Order | undefined;
  if (!order) return notFound('order');
  // Platform admins (ops console) can update any order; in the emulator the resident can simulate the partner.
  const allowed = caller.platformRole === 'platform_admin' || (isEmulator() && order.residentUid === caller.uid) || (await providerStaff(caller.uid, order.providerId));
  if (!allowed) notAllowed();
  const ORDER: ServiceOrderStatus[] = ['placed', 'accepted', 'in_progress', 'ready', 'delivered'];
  if (order.status === 'delivered' || order.status === 'cancelled' || order.status === 'failed') fail('failed-precondition', 'This order is already closed.');
  if (ORDER.includes(status) && ORDER.indexOf(status) < ORDER.indexOf(order.status)) fail('failed-precondition', 'Order status cannot move backwards.');
  await ref.update({ status, updatedAt: Date.now() });
  return { ok: true };
});

async function providerStaff(uid: string, providerId: string) {
  return (await db.doc(`providers/${providerId}/staff/${uid}`).get()).exists;
}

/**
 * On delivery: compute the revenue split ONCE with the rule in effect, write the
 * platform ledger (admin-only) and the property partner ledger (owner-visible).
 * Ledger ids = order id ⇒ idempotent on retries.
 */
export const onServiceOrderWritten = onDocumentWritten('organizations/{orgId}/serviceOrders/{orderId}', async (event) => {
  const before = event.data?.before.data() as Order | undefined;
  const after = event.data?.after.data() as Order | undefined;
  if (!after || before?.status === after.status) return;
  const labels: Partial<Record<ServiceOrderStatus, string>> = { accepted: 'accepted', in_progress: 'being prepared', ready: 'ready', delivered: 'delivered ✓', cancelled: 'cancelled', failed: 'could not be completed' };
  if (labels[after.status]) await notifyUsers([after.residentUid], { kind: 'service', title: `Your ${after.category} order is ${labels[after.status]}`, body: after.items.map((i) => `${i.qty}× ${i.name}`).join(', '), link: 'habistat://services' });
  if (after.status !== 'delivered') return;

  const rules = (await db.collection('revenueRules').where('active', '==', true).get()).docs.map((s) => s.data() as RevenueShareRule);
  const split = splitForOrder(after.gross, rules, { category: after.category, providerId: after.providerId, orgId: after.orgId, propertyId: after.propertyId, at: after.createdAt });
  const period = periodOf(after.updatedAt);
  const t = Date.now();
  const batch = db.batch();
  batch.set(db.doc(`platformLedger/${after.id}`), { orderId: after.id, orgId: after.orgId, propertyId: after.propertyId, providerId: after.providerId, category: after.category, period, ...split, createdAt: t });
  batch.set(db.doc(`${paths.orgCol(after.orgId, 'ledger')}/${after.id}`), { orderId: after.id, propertyId: after.propertyId, category: after.category, period, gross: after.gross, partner: split.partner, createdAt: t });
  await batch.commit();
  await bump(['platform', `property_${after.propertyId}`], { serviceGmv: after.gross, thikanoRevenue: split.thikano, partnerEarnings: split.partner });
});

/** Owner earnings summary (partner share only — provider/Habistat economics stay internal). */
export const getPartnerEarnings = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const propertyId = id(d, 'propertyId');
  const period = typeof d.period === 'string' && /^20\d{2}-\d{2}$/.test(d.period) ? d.period : periodOf(Date.now());
  await requirePermission(caller, orgId, 'earnings.read', propertyId);
  const snap = await db.collection(paths.orgCol(orgId, 'ledger')).where('propertyId', '==', propertyId).where('period', '==', period).get();
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const s of snap.docs) {
    const e = s.data() as { category: string; partner: number };
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.partner;
    total += e.partner;
  }
  return { period, total, byCategory, orders: snap.size, totalLabel: formatINR(total) };
});

export const upsertRevenueRule = onCall(async (req) => {
  const caller = requireAuth(req);
  requirePlatformAdmin(caller);
  const rule = obj(req.data) as unknown as RevenueShareRule;
  try {
    validateRule(rule);
  } catch (e) {
    badInput((e as Error).message);
  }
  await db.doc(`revenueRules/${id(rule as unknown as Record<string, unknown>, 'id')}`).set({ ...rule, updatedAt: Date.now(), updatedBy: caller.uid });
  await audit({ actorUid: caller.uid, actorRole: 'platform_admin', action: 'revenue_rule.upserted', entity: 'revenueRule', entityId: rule.id, metadata: { ...rule } });
  return { ok: true };
});

