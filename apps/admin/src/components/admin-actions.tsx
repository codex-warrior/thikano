'use client';

import { useState } from 'react';
import { Button } from '@thikano/web-ui';
import { useAction } from '@/lib/use-action';

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-[var(--shadow-raised)]" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-display text-[18px] font-bold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Err({ error }: { error: string | null }) {
  return error ? <p className="mt-2 rounded-lg bg-bad-100 px-3 py-2 text-[13px] text-bad-600">{error}</p> : null;
}

/** Approve / Request changes / Reject — each decision is audited server-side. */
export function ReviewActions({ orgId, propertyId, name }: { orgId: string; propertyId: string; name: string }) {
  const [mode, setMode] = useState<null | 'request_changes' | 'reject'>(null);
  const [notes, setNotes] = useState('');
  const { run, busy, error } = useAction<Record<string, unknown>>('reviewProperty');
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="success" disabled={busy} onClick={() => confirm(`Approve ${name}? Listed rooms will become public.`) && run({ orgId, propertyId, decision: 'approve' })}>
          Approve
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setMode('request_changes')}>
          Request changes
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => setMode('reject')}>
          Reject
        </Button>
      </div>
      {mode === null ? <Err error={error} /> : null}
      {mode ? (
        <Dialog title={mode === 'reject' ? `Reject ${name}` : `Request changes · ${name}`} onClose={() => setMode(null)}>
          <label className="block text-[13px] font-semibold text-ink-700">
            Note to the owner
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={1000} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-navy-500" placeholder="e.g. Please upload clearer photos of the rooms and the ownership document." />
          </label>
          <Err error={error} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button variant={mode === 'reject' ? 'danger' : 'primary'} disabled={busy || notes.trim().length < 3} onClick={async () => (await run({ orgId, propertyId, decision: mode, notes })) && setMode(null)}>
              {mode === 'reject' ? 'Reject property' : 'Send request'}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

export function SuspendButton({ kind, orgId, propertyId, roomId, suspended, label }: { kind: 'property' | 'room'; orgId: string; propertyId: string; roomId?: string; suspended: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { run, busy, error } = useAction<Record<string, unknown>>(kind === 'property' ? 'setPropertySuspended' : 'setRoomSuspended');
  return (
    <>
      <Button size="sm" variant={suspended ? 'secondary' : 'danger'} onClick={() => setOpen(true)}>
        {suspended ? 'Reinstate' : 'Suspend'}
      </Button>
      {open ? (
        <Dialog title={`${suspended ? 'Reinstate' : 'Suspend'} ${label}`} onClose={() => setOpen(false)}>
          <p className="text-[13.5px] text-ink-500">{suspended ? 'Listings become visible again if the owner has them listed.' : 'All public listings are hidden immediately. The owner keeps access to their operations.'}</p>
          <label className="mt-3 block text-[13px] font-semibold text-ink-700">
            Reason (recorded in the audit log)
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-line-strong px-3 text-[14px] outline-none focus:border-navy-500" />
          </label>
          <Err error={error} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant={suspended ? 'primary' : 'danger'} disabled={busy || reason.trim().length < 3} onClick={async () => (await run({ orgId, propertyId, ...(roomId ? { roomId } : {}), suspended: !suspended, reason })) && setOpen(false)}>
              Confirm
            </Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

export function GrantRoleForm() {
  const { run, busy, error } = useAction<Record<string, unknown>>('setPlatformRole');
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const role = String(f.get('role'));
        const r = await run({ email: String(f.get('email')).trim(), role: role === 'none' ? null : role });
        if (r) setDone('Updated ✓ — takes effect at their next sign-in.');
      }}
    >
      <label className="block flex-1 text-[13px] font-semibold text-ink-700">
        Staff email
        <input name="email" type="email" required className="mt-1.5 h-11 w-full rounded-lg border border-line-strong px-3 text-[14px] outline-none focus:border-navy-500" />
      </label>
      <label className="block text-[13px] font-semibold text-ink-700">
        Role
        <select name="role" className="mt-1.5 h-11 rounded-lg border border-line-strong px-3 text-[14px]">
          <option value="platform_support">Support</option>
          <option value="platform_admin">Admin</option>
          <option value="none">Remove access</option>
        </select>
      </label>
      <Button type="submit" disabled={busy}>
        Save
      </Button>
      {done ? <p className="w-full text-[13px] text-ok-600">{done}</p> : null}
      <Err error={error} />
    </form>
  );
}
