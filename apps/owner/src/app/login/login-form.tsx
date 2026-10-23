'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { toFriendly } from '@thikano/client';
import { buttonClass } from '@thikano/web-ui';
import { firebase } from '@/lib/firebase';

export function LoginForm({ devHint }: { devHint: boolean }) {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(firebase().auth, String(f.get('email')).trim(), String(f.get('password')));
      const res = await fetch('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: await cred.user.getIdToken() }) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Please sign in again.');
      router.replace(next.startsWith('/') ? next : '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && !('code' in err) ? err.message : toFriendly(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm" noValidate>
      <h1 className="text-[24px] font-bold">Sign in</h1>
      <p className="mt-1 text-[14px] text-ink-500">Use the email registered with THIKANO.</p>
      <label className="mt-8 block text-[13px] font-semibold text-ink-700" htmlFor="email">
        Email
      </label>
      <input id="email" name="email" type="email" autoComplete="username" required className="mt-1.5 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] outline-none focus:border-navy-500" placeholder="you@example.com" />
      <label className="mt-4 block text-[13px] font-semibold text-ink-700" htmlFor="password">
        Password
      </label>
      <input id="password" name="password" type="password" autoComplete="current-password" required className="mt-1.5 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] outline-none focus:border-navy-500" />
      {error ? <p className="mt-3 text-[13px] font-medium text-bad-600" role="alert">{error}</p> : null}
      <button type="submit" disabled={busy} className={buttonClass('primary', 'lg') + ' mt-6 w-full'}>
        {busy ? 'Signing in…' : 'Continue'}
      </button>
      {devHint ? (
        <p className="mt-4 rounded-lg bg-navy-50 p-3 text-[12.5px] text-ink-500">
          Local emulator: <b>shashank@thikano.dev</b> / <b>thikano-dev-123</b>
        </p>
      ) : null}
    </form>
  );
}
