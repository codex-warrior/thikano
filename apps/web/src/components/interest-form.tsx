'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck, Check, Heart } from 'lucide-react';
import { toFriendly } from '@thikano/client';
import { buttonClass, cx } from '@thikano/web-ui';
import { firebase } from '@/lib/firebase';

type Mode = 'interested' | 'visit';
const PHONE_RE = /^(?:\+?91[\s-]?)?[6-9]\d{9}$/;
const DRAFT_KEY = 'thikano.lead-draft';

/**
 * Lead capture without installing the app or signing in. Calls the public
 * `createLead` function (rate-limited, App Check in production). Form input is kept
 * in localStorage so a dropped connection never loses what the student typed.
 */
export function InterestPanel({ slug, roomLabel, source }: { slug: string; roomLabel: string; source?: 'qr' | 'discover' }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'new' | 'duplicate' | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      setDraft(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}'));
    } catch {
      /* storage unavailable */
    }
  }, []);
  const remember = (k: string, v: string) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name') ?? '').trim();
    const phone = String(f.get('phone') ?? '').replace(/\s/g, '');
    const date = String(f.get('date') ?? '');
    if (name.length < 2) return setError('Please enter your name.');
    if (!PHONE_RE.test(phone)) return setError('Please enter a valid 10-digit mobile number.');
    setError(null);
    setBusy(true);
    try {
      const at = date ? new Date(`${date}T${mode === 'visit' ? '17:00' : '00:00'}:00+05:30`).getTime() : undefined;
      const r = await firebase().call<Record<string, unknown>, { duplicate: boolean }>('createLead', {
        slug, name, phone, intent: mode, message: String(f.get('message') ?? ''), source,
        ...(mode === 'visit' ? { visitAt: at } : { expectedMoveIn: at }),
      });
      setDone(r.duplicate ? 'duplicate' : 'new');
    } catch (err) {
      setError(toFriendly(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-ok-100 text-ok-600">
          <Check size={20} />
        </div>
        <p className="mt-3 font-display text-[17px] font-bold">{done === 'new' ? 'Request sent ✓' : 'You’re already on the list ✓'}</p>
        <p className="mt-1 text-[13px] text-ink-500">The owner will call you soon. Keep your phone handy.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      {mode === null ? (
        <div className="grid gap-2">
          <button className={buttonClass('primary', 'lg')} onClick={() => setMode('interested')}>
            <Heart size={17} /> I&apos;m interested
          </button>
          <button className={buttonClass('secondary', 'lg')} onClick={() => setMode('visit')}>
            <CalendarCheck size={17} /> Request a visit
          </button>
          <p className="mt-1 text-center text-[12px] text-ink-400">No app needed. The owner will contact you.</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <p className="font-display text-[16px] font-bold">{mode === 'visit' ? `Visit ${roomLabel}` : `Interested in ${roomLabel}`}</p>
          <Field label="Your name" name="name" autoComplete="name" defaultValue={draft.name} onChange={(v) => remember('name', v)} />
          <Field label="Mobile number" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" defaultValue={draft.phone} onChange={(v) => remember('phone', v)} />
          <Field label={mode === 'visit' ? 'Preferred visit date' : 'Expected move-in'} name="date" type="date" min={new Date().toISOString().slice(0, 10)} />
          <label className="block text-[13px] font-semibold text-ink-700">
            Message <span className="font-normal text-ink-400">(optional)</span>
            <textarea name="message" rows={2} maxLength={500} className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[15px] outline-none focus:border-navy-500" />
          </label>
          {error ? (
            <p className="text-[13px] font-medium text-bad-600" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy} className={cx(buttonClass('primary', 'lg'), 'w-full')}>
            {busy ? 'Sending…' : 'Send'}
          </button>
          <button type="button" onClick={() => setMode(null)} className="w-full text-[13px] text-ink-500">
            Cancel
          </button>
          <p className="text-center text-[11.5px] text-ink-400">Your number is shared only with this property&apos;s owner.</p>
        </form>
      )}
    </div>
  );
}

function Field({ label, onChange, ...rest }: { label: string; onChange?: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  return (
    <label className="block text-[13px] font-semibold text-ink-700">
      {label}
      <input {...rest} onChange={(e) => onChange?.(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] font-normal outline-none focus:border-navy-500" />
    </label>
  );
}

/** Counts a view once per page load (server dedupes per IP/hour). */
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    firebase().call('trackRoomView', { slug }).catch(() => undefined);
  }, [slug]);
  return null;
}
