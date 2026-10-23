import './app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const adminDb = getFirestore();
export const adminAuth = getAuth();

export * from './session';
