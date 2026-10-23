import AsyncStorage from '@react-native-async-storage/async-storage';
import { onIdTokenChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { firebase } from './firebase';

/**
 * Mode is DERIVED from the account — never chosen in the UI:
 *  - guest     → not signed in, browsing Discover
 *  - student   → signed in, no active stay
 *  - resident  → ID token carries the `stay` claim (set by the move-in function)
 */
export type Mode = 'loading' | 'guest' | 'student' | 'resident';

export interface Profile {
  uid: string;
  displayName: string;
  phone: string | null;
  activeStay: { orgId: string; propertyId: string; residentId: string } | null;
}

interface Session {
  mode: Mode;
  user: User | null;
  profile: Profile | null;
  onboarded: boolean;
  finishOnboarding: () => void;
  /** Re-read claims + profile (after sign-in or when a stay may have changed). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);
const ONBOARDED = 'thikano.onboarded';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboarded, setOnboarded] = useState(true);

  const resolve = useCallback(async (u: User | null, force = false) => {
    if (!u) {
      setProfile(null);
      setMode('guest');
      return;
    }
    try {
      const token = await u.getIdTokenResult(force);
      const p = await firebase().call<unknown, { profile: Profile }>('ensureProfile');
      setProfile(p.profile);
      setMode(token.claims.stay ? 'resident' : 'student');
    } catch {
      // Offline or function unavailable: fall back to the token alone.
      const token = await u.getIdTokenResult().catch(() => null);
      setMode(token?.claims.stay ? 'resident' : 'student');
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED)
      .then((v) => setOnboarded(v === '1'))
      .catch(() => setOnboarded(false));
    return onIdTokenChanged(firebase().auth, (u) => {
      setUser(u);
      void resolve(u);
    });
  }, [resolve]);

  const value = useMemo<Session>(
    () => ({
      mode,
      user,
      profile,
      onboarded,
      finishOnboarding: () => {
        setOnboarded(true);
        AsyncStorage.setItem(ONBOARDED, '1').catch(() => undefined);
      },
      refresh: () => resolve(firebase().auth.currentUser, true),
      signOut: async () => {
        await fbSignOut(firebase().auth);
      },
    }),
    [mode, user, profile, onboarded, resolve],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}
