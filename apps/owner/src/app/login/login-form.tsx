'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, type UserCredential } from 'firebase/auth';
import { toFriendly } from '@thikano/client';
import { buttonClass } from '@thikano/web-ui';
import { firebase } from '@/lib/firebase';

export function LoginForm({ devHint }: { devHint: boolean }) {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(cred: UserCredential) {
    const res = await fetch('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: await cred.user.getIdToken() }) });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Please sign in again.');
    router.replace(next.startsWith('/') ? next : '/');
    router.refresh();
  }

  async function run(fn: () => Promise<UserCredential>) {
    setBusy(true);
    setError(null);
    try {
      await finish(await fn());
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') setError(null);
      else setError(err instanceof Error && !code ? err.message : toFriendly(err));
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(() => signInWithEmailAndPassword(firebase().auth, String(f.get('email')).trim(), String(f.get('password'))));
  }

  function google() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    void run(() => signInWithPopup(firebase().auth, provider));
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm" noValidate>
      <h1 className="text-[24px] font-bold">Sign in</h1>
      <p className="mt-1 text-[14px] text-ink-500">Use the email registered with Habistat.</p>
      <button type="button" onClick={google} disabled={busy} className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-line-strong bg-surface text-[15px] font-semibold text-ink-900 hover:bg-canvas disabled:opacity-60">
        <GoogleMark /> Continue with Google
      </button>
      <div className="my-6 flex items-center gap-3 text-[12px] text-ink-400">
        <span className="h-px flex-1 bg-line" /> or use email <span className="h-px flex-1 bg-line" />
      </div>
      <label className="block text-[13px] font-semibold text-ink-700" htmlFor="email">
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

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
