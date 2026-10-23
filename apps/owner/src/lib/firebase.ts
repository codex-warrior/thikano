'use client';

import { initThikano } from '@thikano/client';

/** Browser Firebase client. Env is read literally so Next inlines it at build time. */
export function firebase() {
  return initThikano({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    emulatorHost: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || null,
  });
}
