import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { isEmulator } from './admin';
import { fail } from './errors';

/**
 * SMS delivery abstraction for OTPs (we generate + verify codes ourselves; see identity.ts).
 *  - EmulatorSmsProvider: logs the message (the emulator also returns the code to the app).
 *  - Msg91SmsProvider: SMS_PROVIDER=msg91 — DLT-registered template via MSG91's flow API.
 *    ⚠ Endpoint + variable name are configurable because MSG91's API docs could not be
 *    verified when this was written — confirm them in the MSG91 panel at activation
 *    (docs/THIKANO-LAUNCH.md).
 */
export const OTP_HMAC_SECRET = defineSecret('OTP_HMAC_SECRET');
export const MSG91_AUTH_KEY = defineSecret('MSG91_AUTH_KEY');
export const OTP_SECRETS = [OTP_HMAC_SECRET, MSG91_AUTH_KEY];

export interface SmsProvider {
  readonly name: string;
  sendOtp(toE164: string, code: string): Promise<void>;
}

class EmulatorSmsProvider implements SmsProvider {
  readonly name = 'emulator';
  async sendOtp(to: string, code: string) {
    logger.info(`[DEV SMS] to ${to}: ${code} is your THIKANO code`);
  }
}

export class Msg91SmsProvider implements SmsProvider {
  readonly name = 'msg91';
  constructor(
    private readonly authKey: string,
    private readonly templateId: string,
    private readonly opts: { url: string; otpVar: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async sendOtp(toE164: string, code: string) {
    const res = await this.fetchImpl(this.opts.url, {
      method: 'POST',
      headers: { authkey: this.authKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ template_id: this.templateId, short_url: '0', recipients: [{ mobiles: toE164.replace(/^\+/, ''), [this.opts.otpVar]: code }] }),
    });
    const json = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!res.ok || json.type === 'error') {
      fail('unavailable', "We couldn't send the code right now. Please try again.", { provider: 'msg91', status: res.status, message: json.message });
    }
  }
}

export function smsProvider(): SmsProvider {
  if (isEmulator()) return new EmulatorSmsProvider();
  if (process.env.SMS_PROVIDER === 'msg91') {
    const key = process.env.MSG91_AUTH_KEY;
    const template = process.env.MSG91_OTP_TEMPLATE_ID;
    if (key && template) {
      return new Msg91SmsProvider(key, template, {
        url: process.env.MSG91_FLOW_URL ?? 'https://control.msg91.com/api/v5/flow',
        otpVar: process.env.MSG91_OTP_VAR ?? 'otp',
      });
    }
  }
  return fail('failed-precondition', 'Phone sign-in is not available yet. Please try again later.', { reason: `SMS provider not configured (${process.env.SMS_PROVIDER ?? 'none'})` });
}
