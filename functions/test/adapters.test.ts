/**
 * Offline tests for external-provider adapters: request shapes, auth, signature checks.
 * Live credentials are never used here.
 */
import { createHmac, generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { RazorpayGateway, verifyRazorpaySignature } from '../src/lib/payments';
import { Msg91SmsProvider } from '../src/lib/sms';
import { apnsJwt } from '../src/lib/push';

type Call = { url: string; init: RequestInit };
const fakeFetch = (status: number, json: unknown, calls: Call[]) =>
  (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;

describe('Razorpay payment links', () => {
  const input = { amount: 950000, currency: 'INR' as const, receipt: 'pay_abc123', customerPhone: '+919000000001', customerName: 'Rohit Singh', description: 'Rent 2026-10', notes: { orgId: 'o1', invoiceId: 'i1', paymentId: 'pay_abc123' } };

  it('creates a link with basic auth and paise amount, returning the hosted URL', async () => {
    const calls: Call[] = [];
    const gw = new RazorpayGateway('rzp_test_key', 'secret', 'https://habistat.com/payment/return', fakeFetch(200, { id: 'plink_123', short_url: 'https://rzp.io/i/abc', status: 'created' }, calls));
    const r = await gw.createIntent(input);
    expect(r).toEqual({ gatewayRef: 'plink_123', mode: 'live', status: 'pending', checkoutUrl: 'https://rzp.io/i/abc' });
    expect(calls[0]!.url).toBe('https://api.razorpay.com/v1/payment_links/');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${Buffer.from('rzp_test_key:secret').toString('base64')}`);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ amount: 950000, currency: 'INR', reference_id: 'pay_abc123', callback_url: 'https://habistat.com/payment/return', callback_method: 'get', customer: { contact: '+919000000001', name: 'Rohit Singh' }, notify: { sms: false, email: false } });
    expect(body.expire_by).toBeGreaterThan(Date.now() / 1000 + 15 * 60);
  });

  it('turns provider errors into a friendly error', async () => {
    const gw = new RazorpayGateway('k', 's', null, fakeFetch(400, { error: { code: 'BAD_REQUEST_ERROR', description: 'x' } }, []));
    await expect(gw.createIntent(input)).rejects.toMatchObject({ message: "We couldn't start the payment. Please try again." });
  });

  it('rejects amounts below ₹1', async () => {
    const gw = new RazorpayGateway('k', 's', null, fakeFetch(200, {}, []));
    await expect(gw.createIntent({ ...input, amount: 50 })).rejects.toMatchObject({ message: 'The minimum online payment is ₹1.' });
  });

  it('verifies webhook signatures on the raw body', () => {
    const raw = Buffer.from('{"event":"payment_link.paid"}');
    const good = createHmac('sha256', 'whsec').update(raw).digest('hex');
    expect(verifyRazorpaySignature(raw, good, 'whsec')).toBe(true);
    expect(verifyRazorpaySignature(raw, good, 'other')).toBe(false);
    expect(verifyRazorpaySignature(Buffer.from('{"event":"payment_link.paid" }'), good, 'whsec')).toBe(false);
    expect(verifyRazorpaySignature(raw, undefined, 'whsec')).toBe(false);
    expect(verifyRazorpaySignature(raw, good, '')).toBe(false);
  });
});

describe('MSG91 OTP SMS', () => {
  it('posts the template with the code to the configured flow URL', async () => {
    const calls: Call[] = [];
    const sms = new Msg91SmsProvider('authkey123', 'tmpl_1', { url: 'https://example.test/flow', otpVar: 'otp' }, fakeFetch(200, { type: 'success' }, calls));
    await sms.sendOtp('+919000000001', '482913');
    expect(calls[0]!.url).toBe('https://example.test/flow');
    expect((calls[0]!.init.headers as Record<string, string>).authkey).toBe('authkey123');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ template_id: 'tmpl_1', short_url: '0', recipients: [{ mobiles: '919000000001', otp: '482913' }] });
  });

  it('fails politely when the provider reports an error', async () => {
    const sms = new Msg91SmsProvider('k', 't', { url: 'https://example.test/flow', otpVar: 'otp' }, fakeFetch(200, { type: 'error', message: 'bad template' }, []));
    await expect(sms.sendOtp('+919000000001', '111111')).rejects.toMatchObject({ message: "We couldn't send the code right now. Please try again." });
  });
});

describe('APNs token auth', () => {
  it('creates an ES256 JWT Apple can verify', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const jwt = apnsJwt(pem, 'KEY123', 'TEAM456', 1_800_000_000_000);
    const [h, p, s] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEY123' });
    expect(JSON.parse(Buffer.from(p!, 'base64url').toString())).toEqual({ iss: 'TEAM456', iat: 1_800_000_000 });
    expect(verify('sha256', Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s!, 'base64url'))).toBe(true);
  });
});
