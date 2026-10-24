import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { formatINR, type Payment } from '@thikano/domain';
import { db } from './lib/admin';
import { notifyOrg, notifyUsers } from './lib/notify';
import { RAZORPAY_WEBHOOK_SECRET, verifyRazorpaySignature, webhookSecret } from './lib/payments';
import { settle } from './operations';

interface RazorpayEvent {
  event: string;
  payload: {
    payment_link?: { entity: { id: string; reference_id?: string; amount_paid?: number; status?: string } };
    payment?: { entity: { id: string; amount?: number } };
  };
}

/**
 * Razorpay webhook: https://<region>-<project>.cloudfunctions.net/razorpayWebhook
 * Verifies the signature on the raw body, dedupes by x-razorpay-event-id, and settles the
 * pending payment created by payRentOnline. Always answers 2xx for events we accept so
 * Razorpay stops retrying; 400 only for bad signatures.
 */
export const razorpayWebhook = onRequest({ secrets: [RAZORPAY_WEBHOOK_SECRET], cors: false }, async (req, res) => {
  if (req.method !== 'POST') return void res.status(405).send('Method not allowed');
  const signature = req.header('x-razorpay-signature');
  if (!verifyRazorpaySignature(req.rawBody, signature, webhookSecret())) {
    logger.warn('razorpay webhook: bad signature');
    return void res.status(400).send('invalid signature');
  }
  const eventId = req.header('x-razorpay-event-id') ?? null;
  const evt = req.body as RazorpayEvent;

  if (eventId) {
    const seen = db.doc(`webhookEvents/razorpay_${eventId}`);
    const fresh = await db.runTransaction(async (tx) => {
      if ((await tx.get(seen)).exists) return false;
      tx.set(seen, { event: evt.event, receivedAt: Date.now(), expiresAt: Date.now() + 30 * 86_400_000 });
      return true;
    });
    if (!fresh) return void res.status(200).send('duplicate');
  }

  if (evt.event !== 'payment_link.paid') return void res.status(200).send('ignored');
  const link = evt.payload.payment_link?.entity;
  if (!link) return void res.status(200).send('no link');

  const pending = await db.collectionGroup('payments').where('gatewayRef', '==', link.id).limit(1).get();
  if (pending.empty) {
    logger.error('razorpay webhook: no pending payment for link', { linkId: link.id, ref: link.reference_id });
    return void res.status(200).send('unknown link');
  }
  const p = pending.docs[0]!.data() as Payment & { orgId: string; amount: number };
  const amount = link.amount_paid ?? p.amount;
  if (amount !== p.amount) logger.warn('razorpay webhook: amount mismatch', { expected: p.amount, paid: amount, payment: p.id });

  const r = await settle({ uid: 'razorpay', system: true }, p.orgId, p.invoiceId, amount, 'gateway', link.id, 'live', p.id);
  if (!r.duplicate) {
    await pending.docs[0]!.ref.update({ gatewayPaymentId: evt.payload.payment?.entity.id ?? null });
    if (r.residentUid) await notifyUsers([r.residentUid], { kind: 'payment', title: 'Payment received ✓', body: `${formatINR(amount)} · Receipt ${r.receiptNo}`, link: 'habistat://stay' });
    await notifyOrg(p.orgId, r.propertyId, 'rent.read', { kind: 'payment', title: 'Rent received online', body: `${formatINR(amount)} · ${r.receiptNo}`, link: '/rent' });
  }
  res.status(200).send('ok');
});
