import { Suspense } from 'react';
import { Logo } from '@thikano/web-ui';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  return (
    <div className="grid min-h-dvh place-items-center bg-navy-950 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-[var(--shadow-raised)]">
        <div className="mb-8">
          <Logo suffix="ADMIN" />
        </div>
        {denied ? <p className="mb-4 rounded-lg bg-bad-100 p-3 text-[13px] font-medium text-bad-600">This account does not have Habistat staff access.</p> : null}
        <Suspense>
          <LoginForm devHint={!!process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST} />
        </Suspense>
      </div>
    </div>
  );
}
