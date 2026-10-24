import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  applyPayment,
  canMoveMaintenance,
  computeLateFee,
  deriveInvoiceStatus,
  dueDateFor,
  formatINR,
  MAINTENANCE_CATEGORY_LABEL,
  outstanding,
  type LateFeePolicy,
  type MaintenanceCategory,
  type MaintenanceIssue,
  type Notice,
  type Parcel,
  type Payment,
  type RentInvoice,
  type Resident,
  type Room,
} from '@thikano/domain';
import { db, paths } from './lib/admin';
import { audit } from './lib/audit';
import { requireAuth, requirePermission, roleLabel, type Caller } from './lib/authz';
import { badInput, notAllowed, notFound } from './lib/errors';
import { notifyOrg, notifyUsers } from './lib/notify';
import { PAYMENT_SECRETS, paymentGateway } from './lib/payments';
import { id, int, obj, oneOf, optStr, str } from './lib/validate';

type Invoice = RentInvoice & { residentUid: string | null; status: string };

const DEFAULT_LATE_FEE: LateFeePolicy = { graceDays: 3, flat: 0, perDay: 0, max: 0 };

async function lateFeePolicy(orgId: string, propertyId: string): Promise<LateFeePolicy> {
  const p = await db.doc(paths.property(orgId, propertyId)).get();
  return (p.get('lateFeePolicy') as LateFeePolicy | undefined) ?? DEFAULT_LATE_FEE;
}

export function periodOf(t: number): string {
  const ist = new Date(t + 330 * 60_000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ───────────────────────── Rent ─────────────────────────

/** Idempotent: one invoice per resident per period (doc id inv-{residentId}-{period}). */
export async function generateInvoicesFor(orgId: string, propertyId: string, period: string, actor = 'system'): Promise<number> {
  const residents = await db.collection(paths.orgCol(orgId, 'residents')).where('propertyId', '==', propertyId).where('status', 'in', ['active', 'notice']).get();
  let created = 0;
  const t = Date.now();
  for (let i = 0; i < residents.docs.length; i += 200) {
    const batch = db.batch();
    const chunk = residents.docs.slice(i, i + 200);
    const refs = chunk.map((s) => db.doc(`${paths.orgCol(orgId, 'invoices')}/inv-${s.id}-${period}`));
    const existing = await db.getAll(...refs);
    chunk.forEach((s, k) => {
      if (existing[k]!.exists) return;
      const r = s.data() as Resident;
      const dueDate = dueDateFor(period, r.rentDueDay);
      // Residents leaving before this period starts are not billed.
      if (r.moveOutDate && r.moveOutDate < dueDate - 5 * 86_400_000) return;
      batch.set(refs[k]!, {
        id: refs[k]!.id, orgId, propertyId, residentId: s.id, residentUid: r.uid ?? null, period, amount: r.rent, lateFee: 0, paid: 0, dueDate,
        status: deriveInvoiceStatus({ amount: r.rent, lateFee: 0, paid: 0, dueDate }, t), createdAt: t, updatedAt: t, createdBy: actor,
      });
      created++;
    });
    await batch.commit();
  }
  return created;
}

export const generateInvoicesNow = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const propertyId = id(d, 'propertyId');
  const period = str(d, 'period', { pattern: /^20\d{2}-(0[1-9]|1[0-2])$/ });
  const member = await requirePermission(caller, orgId, 'rent.collect', propertyId);
  const created = await generateInvoicesFor(orgId, propertyId, period, caller.uid);
  await audit({ actorUid: caller.uid, actorRole: roleLabel(caller, member), action: 'rent.invoices_generated', entity: 'property', entityId: propertyId, orgId, metadata: { period, created } });
  return { created };
});

/** 1st of every month, 06:00 IST: bill every active resident. */
export const monthlyInvoices = onSchedule({ schedule: '0 6 1 * *', timeZone: 'Asia/Kolkata' }, async () => {
  const period = periodOf(Date.now());
  const props = await db.collectionGroup('properties').where('verification', 'in', ['verified', 'submitted', 'draft', 'changes_requested']).get();
  for (const p of props.docs) await generateInvoicesFor(p.ref.parent.parent!.id, p.id, period);
});

/** Daily 07:00 IST: refresh invoice status + late fees, remind residents with dues. */
export const refreshInvoices = onSchedule({ schedule: '0 7 * * *', timeZone: 'Asia/Kolkata' }, async () => {
  const t = Date.now();
  const open = await db.collectionGroup('invoices').where('status', 'in', ['upcoming', 'due', 'partially_paid', 'overdue']).limit(5000).get();
  const policies = new Map<string, LateFeePolicy>();
  for (const s of open.docs) {
    const inv = s.data() as Invoice;
    const key = `${inv.orgId}/${inv.propertyId}`;
    if (!policies.has(key)) policies.set(key, await lateFeePolicy(inv.orgId, inv.propertyId));
    const lateFee = computeLateFee(inv.dueDate, t, policies.get(key)!);
    const status = deriveInvoiceStatus({ ...inv, lateFee }, t);
    if (status !== inv.status || lateFee !== inv.lateFee) await s.ref.update({ status, lateFee, updatedAt: t });
    if (status === 'due' && inv.status === 'upcoming' && inv.residentUid) {
      await notifyUsers([inv.residentUid], { kind: 'rent', title: 'Rent due soon', body: `${formatINR(outstanding({ ...inv, lateFee }))} due on ${new Date(inv.dueDate + 330 * 60_000).toISOString().slice(0, 10)}`, link: 'habistat://stay' });
    }
  }
});

/**
 * Applies a payment to an invoice atomically. With `pendingPaymentId` (gateway webhook) the
 * existing pending payment is completed, and repeated webhooks are no-ops.
 */
export async function settle(caller: Caller | { uid: string; system: true }, orgId: string, invoiceId: string, amount: number, method: Payment['method'], gatewayRef: string | null, mode: 'test' | 'live' | 'manual', pendingPaymentId?: string) {
  const invRef = db.doc(`${paths.orgCol(orgId, 'invoices')}/${invoiceId}`);
  const payRef = pendingPaymentId ? db.doc(`${paths.orgCol(orgId, 'payments')}/${pendingPaymentId}`) : db.collection(paths.orgCol(orgId, 'payments')).doc();
  return db.runTransaction(async (tx) => {
    const inv = (await tx.get(invRef)).data() as Invoice | undefined;
    if (!inv) return notFound('invoice');
    if (pendingPaymentId) {
      const existing = (await tx.get(payRef)).data() as (Payment & { receiptNo: string }) | undefined;
      if (existing?.status === 'succeeded') return { paymentId: payRef.id, receiptNo: existing.receiptNo, status: deriveInvoiceStatus(inv, Date.now()), residentUid: inv.residentUid, propertyId: inv.propertyId, duplicate: true };
    }
    let paid: number;
    try {
      paid = applyPayment(inv, amount);
    } catch (e) {
      return badInput(e instanceof RangeError && e.message.includes('exceeds') ? `Amount is more than the ${formatINR(outstanding(inv))} due.` : 'Please enter a valid amount.');
    }
    const t = Date.now();
    const status = deriveInvoiceStatus({ ...inv, paid }, t);
    const receiptNo = `TK-${inv.period.replace('-', '')}-${payRef.id.slice(0, 6).toUpperCase()}`;
    tx.update(invRef, { paid, status, updatedAt: t });
    tx.set(payRef, {
      id: payRef.id, orgId, propertyId: inv.propertyId, residentId: inv.residentId, residentUid: inv.residentUid, invoiceId, amount, method, gatewayRef,
      mode, status: 'succeeded', receiptNo, createdAt: t, updatedAt: t, createdBy: caller.uid,
    } satisfies Payment & Record<string, unknown>);
    await audit({ actorUid: caller.uid, actorRole: 'system' in caller ? 'system' : roleLabel(caller), action: 'payment.recorded', entity: 'payment', entityId: payRef.id, orgId, metadata: { invoiceId, amount, method, mode } }, tx);
    return { paymentId: payRef.id, receiptNo, status, residentUid: inv.residentUid, propertyId: inv.propertyId, duplicate: false };
  });
}

/** Owner/manager records a cash/UPI/bank payment received offline. */
export const recordPayment = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const orgId = id(d, 'orgId');
  const invoiceId = id(d, 'invoiceId');
  const amount = int(d, 'amount', { min: 1, max: 100_000_000 });
  const method = oneOf(d, 'method', ['cash', 'upi', 'bank_transfer'] as const);
  const inv = (await db.doc(`${paths.orgCol(orgId, 'invoices')}/${invoiceId}`).get()).data() as Invoice | undefined;
  if (!inv) return notFound('invoice');
  await requirePermission(caller, orgId, 'rent.collect', inv.propertyId);
  const r = await settle(caller, orgId, invoiceId, amount, method, optStr(d, 'reference', 80), 'manual');
  if (r.residentUid) await notifyUsers([r.residentUid], { kind: 'payment', title: 'Payment received ✓', body: `${formatINR(amount)} · Receipt ${r.receiptNo}`, link: 'habistat://stay' });
  return r;
});

/**
 * Resident pays online. Live: creates a Razorpay payment link and a pending payment; the
 * signed webhook (payments.ts) settles it. Emulator / PAYMENTS_MODE=test: settles at once, marked test.
 */
export const payRentOnline = onCall({ secrets: PAYMENT_SECRETS }, async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  if (!caller.stay) notAllowed();
  const orgId = caller.stay!.o;
  const invoiceId = id(d, 'invoiceId');
  const inv = (await db.doc(`${paths.orgCol(orgId, 'invoices')}/${invoiceId}`).get()).data() as Invoice | undefined;
  if (!inv || inv.residentUid !== caller.uid) return notFound('invoice');
  const amount = d.amount == null ? outstanding(inv) : int(d, 'amount', { min: 1 });
  if (amount <= 0) badInput('Nothing to pay on this invoice.');
  if (amount > outstanding(inv)) badInput(`Amount is more than the ${formatINR(outstanding(inv))} due.`);
  const gateway = paymentGateway();
  const payRef = db.collection(paths.orgCol(orgId, 'payments')).doc();
  const res = (await db.doc(`${paths.orgCol(orgId, 'residents')}/${inv.residentId}`).get()).data() as Resident | undefined;
  const intent = await gateway.createIntent({
    amount, currency: 'INR', receipt: payRef.id, customerPhone: caller.phone, customerName: res?.name ?? null,
    description: `Rent ${inv.period}`, notes: { orgId, invoiceId, paymentId: payRef.id },
  });
  if (intent.status !== 'succeeded') {
    const t = Date.now();
    await payRef.set({
      id: payRef.id, orgId, propertyId: inv.propertyId, residentId: inv.residentId, residentUid: inv.residentUid, invoiceId, amount, method: 'gateway',
      gatewayRef: intent.gatewayRef, gateway: gateway.name, mode: intent.mode, status: 'pending', receiptNo: null, createdAt: t, updatedAt: t, createdBy: caller.uid,
    });
    return { pending: true, checkoutUrl: intent.checkoutUrl, paymentId: payRef.id };
  }
  const r = await settle(caller, orgId, invoiceId, amount, 'gateway', intent.gatewayRef, intent.mode);
  await notifyOrg(orgId, r.propertyId, 'rent.read', { kind: 'payment', title: 'Rent received online', body: `${formatINR(amount)} · ${r.receiptNo}`, link: '/rent' });
  return { ...r, mode: intent.mode };
});

// ───────────────────────── Maintenance ─────────────────────────

/** Resident raises an issue — property/building/floor/room/bed come from their stay, never re-entered. */
export const raiseMaintenance = onCall(async (req) => {
  const caller = requireAuth(req);
  if (!caller.stay) return notAllowed();
  const d = obj(req.data);
  const category = oneOf(d, 'category', ['ac', 'fan', 'wifi', 'water', 'electrical', 'furniture', 'plumbing', 'other'] as const satisfies readonly MaintenanceCategory[]);
  const description = str(d, 'description', { min: 3, max: 500 });
  const { o: orgId, p: propertyId, r: residentId } = caller.stay;
  const res = (await db.doc(`${paths.orgCol(orgId, 'residents')}/${residentId}`).get()).data() as Resident | undefined;
  if (!res || res.uid !== caller.uid || res.status === 'moved_out') return notAllowed();
  const room = (await db.doc(paths.room(orgId, propertyId, res.roomId)).get()).data() as Room;
  const ref = db.collection(paths.orgCol(orgId, 'maintenance')).doc();
  const t = Date.now();
  const issue: MaintenanceIssue & { residentUid: string } = {
    id: ref.id, orgId, propertyId, buildingId: room.buildingId, floorId: room.floorId, roomId: res.roomId, bedId: res.bedId, residentId, residentUid: caller.uid,
    category, description, photos: [], status: 'open', assigneeUid: null, resolvedAt: null, createdAt: t, updatedAt: t, createdBy: caller.uid,
  };
  await ref.set(issue);
  await notifyOrg(orgId, propertyId, 'maintenance.read', { kind: 'maintenance', title: `${MAINTENANCE_CATEGORY_LABEL[category]} issue · Room ${room.number}`, body: description, link: `/maintenance?issue=${ref.id}` });
  return { issueId: ref.id };
});

export const onMaintenanceUpdated = onDocumentUpdated('organizations/{orgId}/maintenance/{issueId}', async (event) => {
  const before = event.data?.before.data() as MaintenanceIssue & { residentUid?: string };
  const after = event.data?.after.data() as MaintenanceIssue & { residentUid?: string };
  if (!before || !after || before.status === after.status) return;
  if (!canMoveMaintenance(before.status, after.status)) {
    // Rules restrict fields, the domain restricts transitions: revert illegal jumps.
    await event.data!.after.ref.update({ status: before.status });
    return;
  }
  if (after.status === 'resolved' && !after.resolvedAt) await event.data!.after.ref.update({ resolvedAt: Date.now() });
  if (after.residentUid) {
    const label = { open: 'reopened', assigned: 'assigned', in_progress: 'in progress', resolved: 'resolved ✓', cancelled: 'cancelled' }[after.status];
    await notifyUsers([after.residentUid], { kind: 'maintenance', title: `Your ${MAINTENANCE_CATEGORY_LABEL[after.category]} request is ${label}`, body: after.description, link: 'habistat://stay' });
  }
});

// ───────────────────────── Notices & parcels ─────────────────────────

async function residentUidsFor(orgId: string, propertyId: string, buildingIds: string[] | null): Promise<string[]> {
  const residents = await db.collection(paths.orgCol(orgId, 'residents')).where('propertyId', '==', propertyId).where('status', 'in', ['active', 'notice']).get();
  let list = residents.docs.map((s) => s.data() as Resident);
  if (buildingIds?.length) {
    const rooms = await db.collection(paths.rooms(orgId, propertyId)).get();
    const roomBuilding = new Map(rooms.docs.map((r) => [r.id, (r.data() as Room).buildingId]));
    list = list.filter((r) => buildingIds.includes(roomBuilding.get(r.roomId) ?? ''));
  }
  return list.map((r) => r.uid).filter((u): u is string => !!u);
}

/** Push a notice once, when it is first published. */
export const onNoticeWritten = onDocumentWritten('organizations/{orgId}/notices/{noticeId}', async (event) => {
  const before = event.data?.before.data() as (Notice & { pushedAt?: number }) | undefined;
  const after = event.data?.after.data() as (Notice & { pushedAt?: number }) | undefined;
  if (!after || !after.publishedAt || after.pushedAt || before?.publishedAt) return;
  const uids = await residentUidsFor(event.params.orgId, after.propertyId, after.buildingIds);
  await notifyUsers(uids, { kind: 'notice', title: after.title, body: after.body.slice(0, 140), link: 'habistat://home' });
  await event.data!.after.ref.update({ pushedAt: Date.now() });
});

export const onParcelCreated = onDocumentCreated('organizations/{orgId}/parcels/{parcelId}', async (event) => {
  const p = event.data?.data() as (Parcel & { residentUid?: string }) | undefined;
  if (!p) return;
  let uid = p.residentUid;
  if (!uid) {
    const res = (await db.doc(`${paths.orgCol(event.params.orgId, 'residents')}/${p.residentId}`).get()).data() as Resident | undefined;
    uid = res?.uid ?? undefined;
    if (uid) await event.data!.ref.update({ residentUid: uid });
  }
  if (uid) await notifyUsers([uid], { kind: 'parcel', title: 'Parcel arrived 📦', body: `${p.carrier} · at ${p.location}`, link: 'habistat://home' });
});

