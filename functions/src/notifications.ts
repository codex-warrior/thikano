import { logger } from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db, isEmulator } from './lib/admin';
import { requireAuth } from './lib/authz';
import { badInput } from './lib/errors';
import { APNS_KEY, sendAndroid, sendIos, type Device } from './lib/push';
import { obj, oneOf, str } from './lib/validate';

/** Delivers each inbox item as a push to the user's registered devices; prunes dead tokens. */
export const onInboxItemCreated = onDocumentCreated({ document: 'users/{uid}/inbox/{itemId}', secrets: [APNS_KEY] }, async (event) => {
  const item = event.data?.data() as { title: string; body: string; link?: string; kind: string } | undefined;
  if (!item) return;
  const devicesSnap = await db.collection(`users/${event.params.uid}/devices`).limit(10).get();
  if (devicesSnap.empty) return;
  if (isEmulator()) {
    logger.info('[DEV PUSH] skipped in emulator', { uid: event.params.uid, devices: devicesSnap.size, title: item.title });
    return;
  }
  const devices = devicesSnap.docs.map((d) => ({ ref: d.ref, ...(d.data() as Device) }));
  const msg = { title: item.title, body: item.body.slice(0, 180), data: { link: item.link ?? '', kind: item.kind } };
  const [android, ios] = await Promise.all([
    sendAndroid(devices.filter((d) => d.platform === 'android').map((d) => d.token), msg),
    sendIos(devices.filter((d) => d.platform === 'ios').map((d) => d.token), msg),
  ]);
  const dead = new Set([...android.invalid, ...ios.invalid]);
  await Promise.all(devices.filter((d) => dead.has(d.token)).map((d) => d.ref.delete()));
});

/** Register this device for push (called by the mobile app after permission is granted). */
export const registerDevice = onCall(async (req) => {
  const caller = requireAuth(req);
  const d = obj(req.data);
  const platform = oneOf(d, 'platform', ['android', 'ios'] as const);
  const token = str(d, 'token', { min: 20, max: 4096 });
  const installId = str(d, 'installId', { pattern: /^[A-Za-z0-9_-]{8,64}$/ });
  if (/\s/.test(token)) badInput('Invalid token.');
  await db.doc(`users/${caller.uid}/devices/${installId}`).set({ platform, token, updatedAt: Date.now() });
  return { ok: true };
});
