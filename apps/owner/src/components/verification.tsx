'use client';

import { ShieldCheck } from 'lucide-react';
import { Button } from '@thikano/web-ui';
import { useAction } from '@/lib/use-action';

export function SubmitVerificationButton({ orgId, propertyId }: { orgId: string; propertyId: string }) {
  const { run, busy, error } = useAction<{ orgId: string; propertyId: string }>('submitPropertyForVerification');
  return (
    <div className="flex flex-col items-end gap-1">
      <Button disabled={busy} onClick={() => run({ orgId, propertyId })}>
        <ShieldCheck size={16} /> {busy ? 'Submitting…' : 'Submit for verification'}
      </Button>
      {error ? <span className="max-w-xs text-right text-[12.5px] text-bad-600">{error}</span> : null}
    </div>
  );
}
