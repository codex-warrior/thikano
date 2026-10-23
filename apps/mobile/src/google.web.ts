import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { firebase } from './firebase';

/** Web build: Firebase popup (works against the Auth emulator too). Returns false if the popup was closed. */
export async function signInWithGoogle(): Promise<boolean> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(firebase().auth, provider);
    return true;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return false;
    throw e;
  }
}

export async function signOutGoogle(): Promise<void> {}
