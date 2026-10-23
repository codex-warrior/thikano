import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * Each app passes its own config (Next: NEXT_PUBLIC_*, Expo: EXPO_PUBLIC_*), read with
 * literal env access so bundlers inline it. No credentials live in this package.
 */
export interface ThikanoClientConfig {
  apiKey: string;
  projectId: string;
  authDomain?: string;
  storageBucket?: string;
  appId?: string;
  messagingSenderId?: string;
  /** Host of the local emulator suite (e.g. "127.0.0.1"). Set only in development. */
  emulatorHost?: string | null;
  /** Provide an Auth instance (React Native needs initializeAuth with persistence). */
  authFactory?: (app: FirebaseApp) => Auth;
}

export interface ThikanoClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
  call: <Req = unknown, Res = unknown>(name: string, data?: Req) => Promise<Res>;
}

export const FUNCTIONS_REGION = 'asia-south1';
let instance: ThikanoClient | null = null;

export function initThikano(config: ThikanoClientConfig): ThikanoClient {
  if (instance) return instance;
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: config.apiKey,
        projectId: config.projectId,
        authDomain: config.authDomain ?? `${config.projectId}.firebaseapp.com`,
        storageBucket: config.storageBucket ?? `${config.projectId}.appspot.com`,
        ...(config.appId ? { appId: config.appId } : {}),
        ...(config.messagingSenderId ? { messagingSenderId: config.messagingSenderId } : {}),
      });
  const auth = config.authFactory ? config.authFactory(app) : getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const storage = getStorage(app);
  if (config.emulatorHost) {
    const h = config.emulatorHost;
    connectAuthEmulator(auth, `http://${h}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, h, 8080);
    connectFunctionsEmulator(functions, h, 5001);
    connectStorageEmulator(storage, h, 9199);
  }
  const call = async <Req, Res>(name: string, data?: Req) => {
    try {
      return (await httpsCallable<Req, Res>(functions, name)(data as Req)).data;
    } catch (e) {
      throw new ThikanoError(e);
    }
  };
  instance = { app, auth, db, functions, storage, call };
  return instance;
}

export function thikano(): ThikanoClient {
  if (!instance) throw new Error('initThikano() must be called first');
  return instance;
}

/**
 * Human-safe error. `message` is always presentable; the original error is kept for logs.
 * Callable errors from THIKANO functions already carry friendly messages.
 */
export class ThikanoError extends Error {
  readonly code: string;
  readonly cause: unknown;
  constructor(err: unknown) {
    const code = (err as { code?: string })?.code ?? 'unknown';
    super(friendlyMessage(code, (err as { message?: string })?.message));
    this.name = 'ThikanoError';
    this.code = code;
    this.cause = err;
  }
}

const GENERIC = "We couldn't do that right now. Please try again.";

export function friendlyMessage(code: string, serverMessage?: string): string {
  // Function errors (functions/*) carry messages written for people — except internal ones.
  if (code.startsWith('functions/') && code !== 'functions/internal' && code !== 'functions/unknown' && serverMessage && !/firebase|exception|stack/i.test(serverMessage)) {
    return serverMessage;
  }
  switch (code) {
    case 'permission-denied':
    case 'functions/permission-denied':
      return "You don't have access to this.";
    case 'unavailable':
    case 'functions/unavailable':
    case 'auth/network-request-failed':
      return 'Connection lost. Your information is safe — please try again.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'That email and password do not match.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact THIKANO support.';
    default:
      return GENERIC;
  }
}

export function toFriendly(e: unknown): string {
  return e instanceof ThikanoError ? e.message : friendlyMessage((e as { code?: string })?.code ?? 'unknown');
}
