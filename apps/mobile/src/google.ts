import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebase } from './firebase';

/**
 * Native Google sign-in (Android/iOS): Google ID token → Firebase credential.
 * Requires a development/production build (not Expo Go) and, in Firebase:
 *  - Google provider enabled, web OAuth client ID → EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
 *  - Android: the app's SHA-1 registered; iOS: EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID + URL scheme plugin.
 * Returns false when the user cancels.
 */
let configured = false;

export async function signInWithGoogle(): Promise<boolean> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw Object.assign(new Error('Google sign-in is not configured yet.'), { code: 'thikano/google-not-configured' });
  if (!configured) {
    GoogleSignin.configure({ webClientId, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined });
    configured = true;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return false;
  if (!res.data.idToken) throw Object.assign(new Error('Google did not return an ID token.'), { code: 'thikano/google-no-token' });
  await signInWithCredential(firebase().auth, GoogleAuthProvider.credential(res.data.idToken));
  return true;
}

/** Forget the Google account choice so the next sign-in shows the account picker. */
export async function signOutGoogle(): Promise<void> {
  if (!configured) return;
  await GoogleSignin.signOut().catch(() => undefined);
}
