'use client';

import { useState } from 'react';
import { Check, Copy, MessageCircle, RefreshCw } from 'lucide-react';
import { buttonClass } from '@thikano/web-ui';
import { useAction } from '@/lib/use-action';

const APP_LINK = process.env.NEXT_PUBLIC_PUBLIC_WEB_URL ?? 'https://thikano.in';

export function inviteMessage(name: string, propertyName: string, code: string) {
  return `Hi ${name.split(' ')[0]}! You're now a resident at ${propertyName} on THIKANO — pay rent, raise requests and order food in the app.\n\n1. Get THIKANO: ${APP_LINK}\n2. Continue with Google\n3. Profile → "I live here" → code ${code}`;
}

/** Invite code panel shown after assigning a resident who doesn't have a linked account yet. */
export function InvitePanel({ name, propertyName, code }: { name: string; propertyName: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-canvas p-4 text-center">
      <p className="text-[13px] text-ink-500">Share this code so {name.split(' ')[0]} can link the THIKANO app:</p>
      <p className="mt-2 font-mono text-[28px] font-bold tracking-[0.25em] text-navy-800">{code}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a className={buttonClass('success', 'sm')} href={`https://wa.me/?text=${encodeURIComponent(inviteMessage(name, propertyName, code))}`} target="_blank" rel="noreferrer">
          <MessageCircle size={14} /> WhatsApp
        </a>
        <button
          className={buttonClass('secondary', 'sm')}
          onClick={async () => {
            await navigator.clipboard.writeText(code).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-400">If you added their Gmail address, the app links automatically when they sign in with Google.</p>
    </div>
  );
}

/** Compact row control on the Residents list. */
export function InviteChip({ orgId, residentId, name, propertyName, code }: { orgId: string; residentId: string; name: string; propertyName: string; code: string | null }) {
  const { run, busy, error } = useAction<{ orgId: string; residentId: string }, { inviteCode: string }>('refreshResidentInvite');
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        {code ? (
          <a href={`https://wa.me/?text=${encodeURIComponent(inviteMessage(name, propertyName, code))}`} target="_blank" rel="noreferrer" className="font-mono text-[12.5px] font-semibold text-navy-700 hover:underline" title="Share on WhatsApp">
            {code}
          </a>
        ) : (
          <span className="text-[12.5px] text-ink-400">No code</span>
        )}
        <button onClick={() => run({ orgId, residentId })} disabled={busy} className="text-ink-400 hover:text-navy-700" title="New invite code" aria-label="New invite code">
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>
      {error ? <span className="text-[11.5px] text-bad-600">{error}</span> : null}
    </div>
  );
}
