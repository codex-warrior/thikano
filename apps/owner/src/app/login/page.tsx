import { Suspense } from 'react';
import { Logo } from '@thikano/web-ui';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white lg:flex">
        <Logo tone="light" suffix="OWNER" />
        <div>
          <p className="max-w-md font-display text-[34px] font-bold leading-tight">Run your PG, fill vacant rooms, and earn more — from one place.</p>
          <ul className="mt-8 space-y-3 text-[14.5px] text-navy-200">
            <li>• Rooms & beds with live occupancy</li>
            <li>• Share any room with students on WhatsApp</li>
            <li>• Rent, maintenance and notices without the registers</li>
          </ul>
        </div>
        <p className="text-[12px] text-navy-300">© Habistat · The operating system for PGs & hostels</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo suffix="OWNER" />
          </div>
          <Suspense>
            <LoginForm devHint={!!process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
