'use client';

import { useState } from 'react';
import { Ban, Plus, Trash2, UserPlus, Wrench } from 'lucide-react';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { formatINR, type Bed, type BedStatus } from '@thikano/domain';
import { status as statusTokens } from '@thikano/tokens';
import { Button } from '@thikano/web-ui';
import { useAction } from '@/lib/use-action';
import { useMutation } from '@/lib/use-mutation';
import { Dialog, Field, FormError, MoneyField, rupeesToPaise } from './form';

const LABEL: Record<BedStatus, string> = { available: 'Available', occupied: 'Occupied', reserved: 'Reserved', blocked: 'Blocked', maintenance: 'Maintenance' };

interface Props {
  orgId: string;
  propertyId: string;
  roomId: string;
  uid: string;
  rent: number;
  deposit: number;
  beds: Bed[];
  occupants: Record<string, { name: string; status: string } | null>;
  canWrite: boolean;
  canAssign: boolean;
}

/** Bed-level control. Occupied/reserved only change via move-in / booking functions. */
export function BedManager({ orgId, propertyId, roomId, uid, rent, deposit, beds, occupants, canWrite, canAssign }: Props) {
  const [assigning, setAssigning] = useState<Bed | null>(null);
  const base = `organizations/${orgId}/properties/${propertyId}/beds`;
  const setStatus = useMutation(async (fb, bed: Bed, status: BedStatus) => updateDoc(doc(fb.db, `${base}/${bed.id}`), { status, updatedAt: Date.now() }));
  const remove = useMutation(async (fb, bed: Bed) => deleteDoc(doc(fb.db, `${base}/${bed.id}`)));
  const add = useMutation(async (fb) => {
    const used = new Set(beds.map((b) => b.label));
    const label = 'ABCDEFGHIJKLMNOP'.split('').find((l) => !used.has(l)) ?? String(beds.length + 1);
    const id = `${roomId}-${label}`;
    const t = Date.now();
    await setDoc(doc(fb.db, `${base}/${id}`), { id, orgId, propertyId, roomId, label, status: 'available', residentId: null, rentOverride: null, moveInDate: null, moveOutDate: null, createdAt: t, updatedAt: t, createdBy: uid });
  });
  const error = setStatus.error ?? remove.error ?? add.error;

  return (
    <div>
      <ul className="divide-y divide-line">
        {beds.map((bed) => {
          const tone = statusTokens[bed.status];
          const occ = occupants[bed.id];
          const free = bed.status === 'available';
          return (
            <li key={bed.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="grid size-10 place-items-center rounded-lg bg-navy-50 font-display text-[15px] font-bold text-navy-700">{bed.label}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">{occ ? occ.name : free ? 'Empty' : LABEL[bed.status]}</p>
                <p className="text-[12.5px] text-ink-500">
                  {bed.rentOverride ? `${formatINR(bed.rentOverride)}/month (custom)` : `${formatINR(rent)}/month`}
                  {bed.moveOutDate ? ` · leaving ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(bed.moveOutDate)}` : ''}
                </p>
              </div>
              <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ color: tone.fg, background: tone.bg }}>
                {LABEL[bed.status]}
              </span>
              <div className="flex gap-1">
                {free && canAssign ? (
                  <Button size="sm" onClick={() => setAssigning(bed)}>
                    <UserPlus size={14} /> Assign
                  </Button>
                ) : null}
                {canWrite && free ? (
                  <>
                    <IconBtn label="Block bed" onClick={() => setStatus.run(bed, 'blocked')}>
                      <Ban size={15} />
                    </IconBtn>
                    <IconBtn label="Mark under maintenance" onClick={() => setStatus.run(bed, 'maintenance')}>
                      <Wrench size={15} />
                    </IconBtn>
                    <IconBtn label="Remove bed" danger onClick={() => confirm(`Remove Bed ${bed.label}?`) && remove.run(bed)}>
                      <Trash2 size={15} />
                    </IconBtn>
                  </>
                ) : null}
                {canWrite && (bed.status === 'blocked' || bed.status === 'maintenance') ? (
                  <Button size="sm" variant="secondary" onClick={() => setStatus.run(bed, 'available')}>
                    Make available
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {canWrite ? (
        <button onClick={() => add.run()} disabled={add.busy} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-navy-700">
          <Plus size={15} /> {add.busy ? 'Adding…' : 'Add bed'}
        </button>
      ) : null}
      <FormError error={error} />
      {assigning ? <AssignDialog orgId={orgId} propertyId={propertyId} bed={assigning} rent={assigning.rentOverride ?? rent} deposit={deposit} onClose={() => setAssigning(null)} /> : null}
    </div>
  );
}

function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={`grid size-8 place-items-center rounded-lg text-ink-400 hover:bg-navy-50 ${danger ? 'hover:text-bad-600' : 'hover:text-navy-700'}`}>
      {children}
    </button>
  );
}

/** Direct move-in (walk-in / existing resident). Creates the THIKANO account by phone. */
function AssignDialog({ orgId, propertyId, bed, rent, deposit, onClose }: { orgId: string; propertyId: string; bed: Bed; rent: number; deposit: number; onClose: () => void }) {
  const { run, busy, error, setError } = useAction<Record<string, unknown>, { residentId: string }>('addResident');
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  return (
    <Dialog title={`Assign Bed ${bed.label}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const rentP = rupeesToPaise(f.get('rent'));
          const depositP = rupeesToPaise(f.get('deposit'));
          if (!Number.isFinite(rentP) || !Number.isFinite(depositP)) return setError('Please check the rent and deposit.');
          const moveIn = new Date(`${f.get('moveIn')}T00:00:00+05:30`).getTime();
          const r = await run({ orgId, propertyId, bedId: bed.id, name: f.get('name'), phone: f.get('phone'), rent: rentP, deposit: depositP, moveInDate: moveIn, rentDueDay: Number(f.get('dueDay')) });
          if (r) onClose();
        }}
      >
        <Field label="Resident name" name="name" required minLength={2} autoComplete="off" />
        <Field label="Mobile number" name="phone" type="tel" required placeholder="98XXXXXXXX" hint="They sign in to THIKANO with this number." />
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Monthly rent" name="rent" defaultValue={rent / 100} />
          <MoneyField label="Deposit" name="deposit" defaultValue={deposit / 100} />
          <Field label="Move-in date" name="moveIn" type="date" defaultValue={today} required />
          <Field label="Rent due day" name="dueDay" type="number" min={1} max={28} defaultValue={5} />
        </div>
        <FormError error={error} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Assigning…' : 'Assign bed'}
        </Button>
        <p className="text-[12px] text-ink-400">The first month&apos;s rent is pro-rated automatically.</p>
      </form>
    </Dialog>
  );
}
