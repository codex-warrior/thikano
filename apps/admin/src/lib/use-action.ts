'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { ThikanoError, toFriendly } from '@thikano/client';
import { firebase } from './firebase';

/**
 * Call a Habistat Cloud Function from a client component, then refresh server data.
 * Errors are already human-readable (see @thikano/client friendlyMessage).
 */
export function useAction<Req, Res = unknown>(name: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = useCallback(
    async (data: Req): Promise<Res | null> => {
      setBusy(true);
      setError(null);
      try {
        await firebase().auth.authStateReady();
        if (!firebase().auth.currentUser) {
          // Browser auth was cleared while the server session lives on — sign in again.
          router.replace('/login');
          return null;
        }
        const res = await firebase().call<Req, Res>(name, data);
        startTransition(() => router.refresh());
        return res;
      } catch (e) {
        if (e instanceof ThikanoError && e.code === 'functions/unauthenticated') router.replace('/login');
        setError(toFriendly(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [name, router],
  );
  return { run, busy, error, setError };
}
