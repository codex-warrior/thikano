import { sign } from 'node:crypto';
import { connect } from 'node:http2';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { messaging } from './admin';

/**
 * Native push delivery.
 *  - Android: FCM registration token (expo-notifications getDevicePushTokenAsync) → firebase-admin.
 *  - iOS: raw APNs device token → Apple's HTTP/2 API with a token-based (.p8) JWT,
 *    because firebase-admin cannot address raw APNs tokens.
 */
export const APNS_KEY = defineSecret('APNS_KEY'); // contents of the .p8 file

export interface Device {
  platform: 'android' | 'ios';
  token: string;
}
export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
}
export interface PushResult {
  /** Tokens the platform says are dead — delete them. */
  invalid: string[];
}

export async function sendAndroid(tokens: string[], m: PushMessage): Promise<PushResult> {
  if (!tokens.length) return { invalid: [] };
  const res = await messaging().sendEachForMulticast({
    tokens,
    notification: { title: m.title, body: m.body },
    data: m.data,
    android: { priority: 'high', notification: { channelId: 'default' } },
  });
  const invalid: string[] = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code ?? '';
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') invalid.push(tokens[i]!);
    else if (r.error) logger.warn('FCM send failed', { code });
  });
  return { invalid };
}

let jwtCache: { token: string; at: number } | null = null;

export function apnsJwt(keyP8: string, keyId: string, teamId: string, now = Date.now()): string {
  if (jwtCache && now - jwtCache.at < 50 * 60 * 1000) return jwtCache.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'ES256', kid: keyId })}.${b64({ iss: teamId, iat: Math.floor(now / 1000) })}`;
  const sig = sign('sha256', Buffer.from(unsigned), { key: keyP8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  jwtCache = { token: `${unsigned}.${sig}`, at: now };
  return jwtCache.token;
}

export async function sendIos(tokens: string[], m: PushMessage): Promise<PushResult> {
  const key = process.env.APNS_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const topic = process.env.APNS_BUNDLE_ID;
  if (!tokens.length) return { invalid: [] };
  if (!key || !keyId || !teamId || !topic) {
    logger.info('APNs not configured; iOS push skipped (in-app inbox still updated)', { devices: tokens.length });
    return { invalid: [] };
  }
  const host = process.env.APNS_PRODUCTION === 'false' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  const jwt = apnsJwt(key, keyId, teamId);
  const payload = JSON.stringify({ aps: { alert: { title: m.title, body: m.body }, sound: 'default' }, ...m.data });
  const client = connect(host);
  const invalid: string[] = [];
  try {
    await Promise.all(
      tokens.map(
        (t) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ':method': 'POST',
              ':path': `/3/device/${t}`,
              authorization: `bearer ${jwt}`,
              'apns-topic': topic,
              'apns-push-type': 'alert',
              'apns-priority': '10',
              'content-type': 'application/json',
            });
            let status = 0;
            let body = '';
            req.on('response', (h) => (status = Number(h[':status'])));
            req.on('data', (c) => (body += c));
            req.on('end', () => {
              if (status === 410 || /BadDeviceToken|Unregistered/.test(body)) invalid.push(t);
              else if (status !== 200) logger.warn('APNs send failed', { status, body });
              resolve();
            });
            req.on('error', (e) => {
              logger.warn('APNs request error', { error: String(e) });
              resolve();
            });
            req.end(payload);
          }),
      ),
    );
  } finally {
    client.close();
  }
  return { invalid };
}
