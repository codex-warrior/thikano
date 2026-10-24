'use client';

import { useState } from 'react';
import { Megaphone, UserPlus } from 'lucide-react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { canMoveMaintenance, STAFF_PERMISSION_LABEL, type MaintenanceStatus, type StaffPermission } from '@thikano/domain';
import { Button } from '@thikano/web-ui';
import { useAction } from '@/lib/use-action';
import { newId, useMutation } from '@/lib/use-mutation';
import { CheckGroup, Dialog, Field, FormError, Select, TextArea } from './form';

// ───────────── Maintenance ─────────────

const NEXT: { to: MaintenanceStatus; label: string; variant: 'primary' | 'secondary' | 'success' }[] = [
  { to: 'assigned', label: 'Assign to me', variant: 'secondary' },
  { to: 'in_progress', label: 'Start work', variant: 'secondary' },
  { to: 'resolved', label: 'Resolve', variant: 'success' },
];

export function MaintenanceActions({ orgId, issueId, status, uid }: { orgId: string; issueId: string; status: MaintenanceStatus; uid: string }) {
  const m = useMutation(async (fb, to: MaintenanceStatus) =>
    updateDoc(doc(fb.db, `organizations/${orgId}/maintenance/${issueId}`), { status: to, updatedAt: Date.now(), ...(to === 'assigned' ? { assigneeUid: uid } : {}), ...(to === 'resolved' ? { resolvedAt: Date.now() } : {}) }),
  );
  const options = NEXT.filter((n) => canMoveMaintenance(status, n.to) && !(status === 'in_progress' && n.to === 'assigned'));
  if (status === 'resolved') {
    return (
      <Button size="sm" variant="ghost" disabled={m.busy} onClick={() => m.run('open')}>
        Reopen
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {options.map((o) => (
          <Button key={o.to} size="sm" variant={o.variant} disabled={m.busy} onClick={() => m.run(o.to)}>
            {o.label}
          </Button>
        ))}
      </div>
      {m.error ? <span className="text-[12px] text-bad-600">{m.error}</span> : null}
    </div>
  );
}

// ───────────── Notices ─────────────

export function NewNoticeButton({ orgId, propertyId, uid, buildings }: { orgId: string; propertyId: string; uid: string; buildings: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const m = useMutation(async (fb, f: FormData) => {
    const id = newId('ntc');
    const t = Date.now();
    const date = String(f.get('date') || '');
    const start = date && f.get('from') ? new Date(`${date}T${f.get('from')}:00+05:30`).getTime() : null;
    const end = date && f.get('to') ? new Date(`${date}T${f.get('to')}:00+05:30`).getTime() : null;
    const building = String(f.get('building'));
    await setDoc(doc(fb.db, `organizations/${orgId}/notices/${id}`), {
      id, orgId, propertyId, buildingIds: building === 'all' ? null : [building], title: String(f.get('title')).trim(), body: String(f.get('body')).trim(),
      startsAt: start, endsAt: end, publishedAt: t, createdAt: t, updatedAt: t, createdBy: uid,
    });
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Megaphone size={16} /> New notice
      </Button>
      {open ? (
        <Dialog title="New notice" onClose={() => setOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (!String(f.get('title')).trim()) return m.setError('Please add a title.');
              if ((await m.run(f)) !== null) setOpen(false);
            }}
          >
            <Field label="Title" name="title" placeholder="Water maintenance" required maxLength={80} />
            <TextArea label="Details" name="body" rows={3} placeholder="Tank cleaning. Water supply will be off." maxLength={600} />
            <div className="grid grid-cols-3 gap-2">
              <Field label="Date (optional)" name="date" type="date" />
              <Field label="From" name="from" type="time" />
              <Field label="To" name="to" type="time" />
            </div>
            <Select label="Who should see it" name="building" defaultValue="all">
              <option value="all">Everyone at this property</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} only
                </option>
              ))}
            </Select>
            <FormError error={m.error} />
            <Button type="submit" className="w-full" disabled={m.busy}>
              {m.busy ? 'Publishing…' : 'Publish'}
            </Button>
            <p className="text-[12px] text-ink-400">Residents get a notification and see it on their Habistat home.</p>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

// ───────────── Staff ─────────────

const PERMS = Object.keys(STAFF_PERMISSION_LABEL) as StaffPermission[];

export function AddMemberButton({ orgId, properties }: { orgId: string; properties: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<'manager' | 'staff'>('staff');
  const { run, busy, error, setError } = useAction<Record<string, unknown>>('addMember');
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus size={16} /> Add team member
      </Button>
      {open ? (
        <Dialog title="Add team member" onClose={() => setOpen(false)} wide>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const scope = f.getAll('propertyIds').map(String);
              const contact = String(f.get('contact')).trim();
              if (!contact) return setError('Add a mobile number or email.');
              const isEmail = contact.includes('@');
              const r = await run({
                orgId, role, displayName: f.get('displayName'),
                ...(isEmail ? { email: contact } : { phone: contact }),
                propertyIds: scope.includes('all') || scope.length === 0 ? null : scope,
                permissions: role === 'staff' ? f.getAll('permissions').map(String) : undefined,
              });
              if (r) setOpen(false);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" name="displayName" required minLength={2} />
              <Field label="Mobile or email" name="contact" required placeholder="98XXXXXXXX or name@email.com" />
            </div>
            <Select label="Role" name="role" value={role} onChange={(e) => setRole(e.target.value as 'manager' | 'staff')}>
              <option value="manager">Manager — can do everything except team & payouts</option>
              <option value="staff">Staff — only what you allow</option>
            </Select>
            <CheckGroup label="Properties" name="propertyIds" options={[{ value: 'all', label: 'All properties' }, ...properties.map((p) => ({ value: p.id, label: p.name }))]} defaultValue={['all']} />
            {role === 'staff' ? <CheckGroup label="Allowed to" name="permissions" options={PERMS.map((p) => ({ value: p, label: STAFF_PERMISSION_LABEL[p] }))} defaultValue={['maintenance.read', 'maintenance.write', 'inventory.read']} /> : null}
            <FormError error={error} />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Adding…' : 'Add member'}
            </Button>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

export function RemoveMemberButton({ orgId, uid, name }: { orgId: string; uid: string; name: string }) {
  const { run, busy, error } = useAction<Record<string, unknown>>('updateMember');
  return (
    <div className="flex flex-col items-end">
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => confirm(`Remove ${name}'s access?`) && run({ orgId, uid, status: 'removed' })}>
        Remove
      </Button>
      {error ? <span className="text-[12px] text-bad-600">{error}</span> : null}
    </div>
  );
}
