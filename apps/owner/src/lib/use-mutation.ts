'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { toFriendly, type ThikanoClient } from '@thikano/client';
import { firebase } from './firebase';

/** Direct (rules-validated) Firestore/Storage writes from the browser, then refresh. */
export function useMutation<A extends unknown[], R>(fn: (fb: ThikanoClient, ...args: A) => Promise<R>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const run = useCallback(
    async (...args: A): Promise<R | null> => {
      setBusy(true);
      setError(null);
      try {
        const fb = firebase();
        await fb.auth.authStateReady();
        if (!fb.auth.currentUser) {
          router.replace('/login');
          return null;
        }
        const r = await fn(fb, ...args);
        startTransition(() => router.refresh());
        return r;
      } catch (e) {
        console.error(e);
        setError(toFriendly(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [fn, router],
  );
  return { run, busy, error, setError };
}

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
