'use client';

import { useRouter } from 'next/navigation';
import { buttonClass } from '@thikano/web-ui';
import { useAction } from '@/lib/use-action';
import { Field } from '@/components/form';

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const { run, busy, error } = useAction<{ name: string; ownerName: string }, { orgId: string }>('createOrganization');
  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const res = await run({ name: String(f.get('name')), ownerName: String(f.get('ownerName')) });
        if (res) router.replace('/properties/new');
      }}
    >
      <Field label="Your name" name="ownerName" defaultValue={defaultName} required minLength={2} />
      <Field label="Business name" name="name" placeholder="e.g. Sunrise Stays" required minLength={2} hint="Shown to your staff. Each PG gets its own name next." />
      {error ? <p className="text-[13px] font-medium text-bad-600" role="alert">{error}</p> : null}
      <button className={buttonClass('primary', 'lg') + ' w-full'} disabled={busy}>
        {busy ? 'Setting up…' : 'Continue'}
      </button>
    </form>
  );
}
