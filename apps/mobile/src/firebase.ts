import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FirebaseAuth from 'firebase/auth';
import { initThikano } from '@thikano/client';

/**
 * Mobile Firebase client. Env is read literally so Expo inlines it.
 * Emulator host: 127.0.0.1 for web/iOS simulator, 10.0.2.2 for the Android emulator,
 * or your computer's LAN IP for a physical device (EXPO_PUBLIC_FIREBASE_EMULATOR_HOST).
 */
type RNPersistence = (storage: typeof AsyncStorage) => FirebaseAuth.Persistence;
// Exported by @firebase/auth's react-native build; absent from the default typings.
const getReactNativePersistence = (FirebaseAuth as unknown as { getReactNativePersistence?: RNPersistence }).getReactNativePersistence;

export function firebase() {
  return initThikano({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    emulatorHost: process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || null,
    authFactory: (app) =>
      Platform.OS === 'web' || !getReactNativePersistence
        ? FirebaseAuth.getAuth(app)
        : FirebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }),
  });
}
