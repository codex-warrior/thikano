import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Logo } from '@thikano/web-ui';
import { ownerContext, SESSION_COOKIE, verifySession } from '@thikano/server';
import { OnboardingForm } from './onboarding-form';

export const metadata = { title: 'Set up your business' };

export default async function Onboarding() {
  const decoded = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!decoded) redirect('/login');
  if (await ownerContext(decoded)) redirect('/');
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-md">
        <Logo suffix="OWNER" />
        <h1 className="mt-10 text-[26px] font-bold">Welcome to Habistat</h1>
        <p className="mt-1 text-[14.5px] text-ink-500">Tell us the name of your PG business. You&apos;ll add your properties and rooms next.</p>
        <OnboardingForm defaultName={(decoded.name as string) ?? ''} />
      </div>
    </div>
  );
}
