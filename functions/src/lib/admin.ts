import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

if (getApps().length === 0) initializeApp();

export const db = getFirestore();
export const auth = getAuth();
export const messaging = () => getMessaging();
export { FieldValue };

/** True inside the local emulator suite — dev-only code paths must check this. */
export const isEmulator = () => process.env.FUNCTIONS_EMULATOR === 'true';

export const paths = {
  org: (o: string) => `organizations/${o}`,
  member: (o: string, u: string) => `organizations/${o}/members/${u}`,
  property: (o: string, p: string) => `organizations/${o}/properties/${p}`,
  rooms: (o: string, p: string) => `organizations/${o}/properties/${p}/rooms`,
  room: (o: string, p: string, r: string) => `organizations/${o}/properties/${p}/rooms/${r}`,
  beds: (o: string, p: string) => `organizations/${o}/properties/${p}/beds`,
  bed: (o: string, p: string, b: string) => `organizations/${o}/properties/${p}/beds/${b}`,
  buildings: (o: string, p: string) => `organizations/${o}/properties/${p}/buildings`,
  floors: (o: string, p: string) => `organizations/${o}/properties/${p}/floors`,
  orgCol: (o: string, c: string) => `organizations/${o}/${c}`,
};
