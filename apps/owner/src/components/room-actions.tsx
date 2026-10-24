'use client';

import { useState } from 'react';
import { Check, Copy, MessageCircle, Pause, QrCode, Rocket, Share2 } from 'lucide-react';
import { Button, buttonClass } from '@thikano/web-ui';
import { firebase } from '@/lib/firebase';
import { useAction } from '@/lib/use-action';
import { Dialog, FormError } from './form';

const PUBLIC_BASE = process.env.NEXT_PUBLIC_PUBLIC_WEB_URL ?? 'http://localhost:3000';

interface RoomRef {
  orgId: string;
  propertyId: string;
  roomId?: string;
}

export function ShareButton({ slug, title, summary, kind = 'room', target, disabledReason }: { slug: string | null | undefined; title: string; summary: string; kind?: 'room' | 'pg'; target: RoomRef; disabledReason?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!slug || disabledReason) {
    return (
      <Button variant="secondary" size="sm" disabled title={disabledReason ?? 'Preparing link…'}>
        <Share2 size={14} /> Share
      </Button>
    );
  }
  const url = `${PUBLIC_BASE}/${kind}/${slug}`;
  const text = `${title}\n${summary}\n${url}`;
  const track = () => firebase().call('trackShare', target).catch(() => undefined);

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title, text: summary, url });
        track();
        return;
      } catch {
        /* cancelled — fall back to sheet */
      }
    }
    setOpen(true);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track();
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <>
      <Button variant="secondary" size="sm" onClick={share}>
        <Share2 size={14} /> Share
      </Button>
      {open ? (
        <Dialog onClose={() => setOpen(false)} title={kind === 'room' ? 'Share room' : 'Share property'}>
          <p className="text-[13.5px] text-ink-500">Anyone with this link sees the photos, rent and live availability — no app needed.</p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2.5">
            <span className="flex-1 truncate font-mono text-[12.5px] text-ink-700">{url}</span>
            <button onClick={copy} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy-700">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a className={buttonClass('success')} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" onClick={track}>
              <MessageCircle size={16} /> WhatsApp
            </a>
            <a className={buttonClass('secondary')} href={`${PUBLIC_BASE}/qr/${kind}/${slug}`} target="_blank" rel="noreferrer">
              <QrCode size={16} /> QR poster
            </a>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

export function ListButton({ target, roomNumber, intent, disabledReason }: { target: Required<RoomRef>; roomNumber: string; intent: string; disabledReason?: string }) {
  const [confirming, setConfirming] = useState(false);
  const { run, busy, error } = useAction<RoomRef & { intent: string }>('setRoomListing');
  if (intent === 'listed') {
    return (
      <>
        <button onClick={() => setConfirming(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-100 px-3 text-[13px] font-semibold text-accent-600 hover:brightness-95" title="Manage listing">
          <Check size={14} /> Listed
        </button>
        {confirming ? (
          <Dialog onClose={() => setConfirming(false)} title={`Room ${roomNumber} listing`}>
            <p className="text-[14px] text-ink-700">Pausing hides this room from students. Your share link will show it as unavailable.</p>
            <FormError error={error} />
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Keep listed
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  if (await run({ ...target, intent: 'unlisted' })) setConfirming(false);
                }}
              >
                <Pause size={14} /> {busy ? 'Unlisting…' : 'Unlist'}
              </Button>
            </div>
          </Dialog>
        ) : null}
      </>
    );
  }
  return (
    <>
      <Button size="sm" onClick={() => setConfirming(true)} disabled={!!disabledReason} title={disabledReason}>
        <Rocket size={14} /> List on Habistat
      </Button>
      {confirming ? (
        <Dialog onClose={() => setConfirming(false)} title={`List Room ${roomNumber}?`}>
          <p className="text-[14px] text-ink-700">Students searching in this area will be able to see this room.</p>
          <p className="mt-2 text-[13px] text-ink-500">We use the photos, rent and amenities you already added. Availability updates automatically as beds fill.</p>
          <FormError error={error} />
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (await run({ ...target, intent: 'listed' })) setConfirming(false);
              }}
            >
              {busy ? 'Publishing…' : 'Publish'}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

export function ListAllButton({ orgId, propertyId, count }: { orgId: string; propertyId: string; count: number }) {
  const [done, setDone] = useState<number | null>(null);
  const { run, busy, error } = useAction<{ orgId: string; propertyId: string }, { listed: number }>('listAllEligibleRooms');
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={busy || count === 0}
        onClick={async () => {
          const r = await run({ orgId, propertyId });
          if (r) setDone(r.listed);
        }}
      >
        <Rocket size={16} /> {busy ? 'Listing…' : `List all eligible vacancies (${count})`}
      </Button>
      {done != null ? <span className="text-[12.5px] font-medium text-ok-600">{done} rooms listed ✓</span> : null}
      {error ? <span className="text-[12.5px] text-bad-600">{error}</span> : null}
    </div>
  );
}
