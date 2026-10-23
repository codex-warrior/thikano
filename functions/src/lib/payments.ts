import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { defineSecret } from 'firebase-functions/params';
import { isEmulator } from './admin';
import { fail } from './errors';

/**
 * Payment gateway abstraction.
 *  - TestGateway: emulator or PAYMENTS_MODE=test — settles immediately, marked `mode: 'test'`.
 *  - RazorpayGateway: PAYMENTS_MODE=razorpay — hosted Payment Link (no native SDK in the app);
 *    the signed `payment_link.paid` webhook settles the invoice (functions/src/payments.ts).
 * API: https://razorpay.com/docs/api/payments/payment-links/create-standard
 */
export const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
export const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
export const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');
export const PAYMENT_SECRETS = [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET];

export interface PaymentIntent {
  gatewayRef: string;
  mode: 'test' | 'live';
  status: 'succeeded' | 'pending';
  checkoutUrl: string | null;
}

export interface CreateIntentInput {
  amount: number; // paise
  currency: 'INR';
  receipt: string; // our payment id (unique, ≤ 40 chars)
  customerPhone: string | null;
  customerName: string | null;
  description: string;
  notes: Record<string, string>;
}

export interface PaymentGateway {
  readonly name: string;
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
}

class TestGateway implements PaymentGateway {
  readonly name = 'test';
  async createIntent(): Promise<PaymentIntent> {
    return { gatewayRef: `test_${randomUUID()}`, mode: 'test', status: 'succeeded', checkoutUrl: null };
  }
}

const RAZORPAY_API = 'https://api.razorpay.com/v1';

export class RazorpayGateway implements PaymentGateway {
  readonly name = 'razorpay';
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly callbackUrl: string | null,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async createIntent(i: CreateIntentInput): Promise<PaymentIntent> {
    if (i.amount < 100) fail('invalid-argument', 'The minimum online payment is ₹1.');
    const body: Record<string, unknown> = {
      amount: i.amount,
      currency: i.currency,
      accept_partial: false,
      reference_id: i.receipt.slice(0, 40),
      description: i.description.slice(0, 2048),
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: i.notes,
      expire_by: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      ...(i.customerPhone ? { customer: { contact: i.customerPhone, ...(i.customerName ? { name: i.customerName } : {}) } } : {}),
      ...(this.callbackUrl ? { callback_url: this.callbackUrl, callback_method: 'get' } : {}),
    };
    const res = await this.fetchImpl(`${RAZORPAY_API}/payment_links/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}` },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; short_url?: string; error?: { code?: string; description?: string } };
    if (!res.ok || !json.id || !json.short_url) {
      return fail('unavailable', "We couldn't start the payment. Please try again.", { status: res.status, error: json.error });
    }
    return { gatewayRef: json.id, mode: 'live', status: 'pending', checkoutUrl: json.short_url };
  }
}

/** Verify `X-Razorpay-Signature`: hex HMAC-SHA256 of the RAW request body with the webhook secret. */
export function verifyRazorpaySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function paymentGateway(): PaymentGateway {
  const mode = process.env.PAYMENTS_MODE ?? (isEmulator() ? 'test' : 'off');
  if (mode === 'test') return new TestGateway();
  if (mode === 'razorpay') {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return fail('failed-precondition', 'Online payments are not available yet. Please pay your owner directly.', { reason: 'Razorpay keys missing' });
    const base = process.env.PUBLIC_WEB_URL;
    return new RazorpayGateway(keyId, keySecret, base ? `${base}/payment/return` : null);
  }
  return fail('failed-precondition', 'Online payments are not available yet. Please pay your owner directly.', { reason: 'PAYMENTS_MODE not set' });
}

/** Webhook secret; the emulator uses a fixed development secret so tests can sign payloads. */
export function webhookSecret(): string {
  const s = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (s) return s;
  return isEmulator() ? 'emulator-razorpay-webhook-secret' : '';
}
