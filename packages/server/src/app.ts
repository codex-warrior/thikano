import { getApps, initializeApp } from 'firebase-admin/app';

/**
 * Firebase Admin for Next.js server code. Imported by every server entry point so no
 * repository depends on import order.
 * Development: FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST + GCLOUD_PROJECT=demo-thikano.
 * Production: Application Default Credentials on the hosting runtime.
 */
if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}
