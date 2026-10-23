'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import type { Booking, Lead } from '@thikano/domain';
import { Button } from '@thikano/web-ui';
import { useAction } from '@/lib/use-action';
import { useMutation } from '@/lib/use-mutation';
import { Dialog, Field, FormError, Select } from './form';
import { InvitePanel } from './invite';

interface Props {
  orgId: string;
  lead: Lead;
  booking: Booking | null;
  freeBeds: { id: string; label: string }[];
  canWrite: boolean;
  canMoveIn: boolean;
  propertyName: string;
}

/** Next step for a lead, driven by the booking state machine (functions enforce it). */
export function LeadActions({ orgId, lead, booking, freeBeds, canWrite, canMoveIn, propertyName }: Props) {
  const [dialog, setDialog] = useState<null | 'visit' | 'book' | 'movein'>(null);
  const setLeadStatus = useMutation(async (fb, status: string) => updateDoc(doc(fb.db, `organizations/${orgId}/leads/${lead.id}`), { status, updatedAt: Date.now() }));
  const start = useAction<{ orgId: string; leadId: string }>('startApplication');
  const advance = useAction<Record<string, unknown>>('advanceBooking');
  const moveIn = useAction<Record<string, unknown>, { inviteCode: string | null }>('moveIn');
  const [invite, setInvite] = useState<string | null | undefined>(undefined);
  const error = setLeadStatus.error ?? start.error ?? advance.error ?? moveIn.error;
  if (!canWrite) return null;
  const go = (to: string, extra: Record<string, unknown> = {}) => advance.run({ orgId, bookingId: booking!.id, to, ...extra });
  const busy = setLeadStatus.busy || start.busy || advance.busy || moveIn.busy;

  let buttons: React.ReactNode = null;
  if (!booking) {
    if (lead.status === 'new') {
      buttons = (
        <>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setLeadStatus.run('contacted')}>
            Mark contacted
          </Button>
          <Button size="sm" disabled={busy} onClick={() => start.run({ orgId, leadId: lead.id })}>
            Start application
          </Button>
        </>
      );
    } else if (['contacted', 'interested', 'visit_scheduled'].includes(lead.status)) {
      buttons = (
        <>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setLeadStatus.run('lost')}>
            Lost
          </Button>
          <Button size="sm" disabled={busy} onClick={() => start.run({ orgId, leadId: lead.id })}>
            Start application
          </Button>
        </>
      );
    }
  } else {
    switch (booking.stage) {
      case 'visit_requested':
        buttons = (
          <>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDialog('visit')}>
              Schedule visit
            </Button>
            <Button size="sm" disabled={busy} onClick={() => go('application')}>
              Start application
            </Button>
          </>
        );
        break;
      case 'visit_scheduled':
        buttons = (
          <Button size="sm" disabled={busy} onClick={() => go('application')}>
            Start application
          </Button>
        );
        break;
      case 'application':
        buttons = (
          <Button size="sm" disabled={busy} onClick={() => go('owner_review')}>
            Review application
          </Button>
        );
        break;
      case 'owner_review':
        buttons = (
          <>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => go('rejected')}>
              Reject
            </Button>
            <Button size="sm" variant="success" disabled={busy} onClick={() => go('approved')}>
              Approve
            </Button>
          </>
        );
        break;
      case 'approved':
        buttons = (
          <Button size="sm" disabled={busy || freeBeds.length === 0} title={freeBeds.length ? undefined : 'No free bed in this room'} onClick={() => setDialog('book')}>
            Book a bed
          </Button>
        );
        break;
      case 'booked':
        buttons = (
          <>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => confirm('Cancel this booking and release the bed?') && go('cancelled')}>
              Cancel
            </Button>
            {canMoveIn ? (
              <Button size="sm" variant="success" disabled={busy} onClick={() => setDialog('movein')}>
                Move in
              </Button>
            ) : null}
          </>
        );
        break;
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">{buttons}</div>
      {error ? <span className="max-w-xs text-right text-[12px] text-bad-600">{error}</span> : null}
      {dialog === 'visit' ? (
        <Dialog title="Schedule visit" onClose={() => setDialog(null)}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const at = new Date(`${f.get('date')}T${f.get('time')}:00+05:30`).getTime();
              if (await go('visit_scheduled', { visitAt: at })) setDialog(null);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" name="date" type="date" required defaultValue={new Date(Date.now() + 86_400_000 + 330 * 60_000).toISOString().slice(0, 10)} />
              <Field label="Time" name="time" type="time" required defaultValue="17:00" />
            </div>
            <FormError error={advance.error} />
            <Button type="submit" className="w-full" disabled={advance.busy}>
              Confirm visit
            </Button>
          </form>
        </Dialog>
      ) : null}
      {dialog === 'book' ? (
        <Dialog title={`Book a bed for ${lead.name}`} onClose={() => setDialog(null)}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (await go('booked', { bedId: f.get('bedId') })) setDialog(null);
            }}
          >
            <Select label="Bed" name="bedId" required>
              {freeBeds.map((b) => (
                <option key={b.id} value={b.id}>
                  Bed {b.label}
                </option>
              ))}
            </Select>
            <p className="text-[12.5px] text-ink-500">The bed is reserved immediately — it disappears from availability on THIKANO.</p>
            <FormError error={advance.error} />
            <Button type="submit" className="w-full" disabled={advance.busy}>
              Reserve bed
            </Button>
          </form>
        </Dialog>
      ) : null}
      {dialog === 'movein' && invite !== undefined ? (
        <Dialog title={`${lead.name} moved in ✓`} onClose={() => (setDialog(null), setInvite(undefined))}>
          {invite ? <InvitePanel name={lead.name} propertyName={propertyName} code={invite} /> : <p className="text-[14px] text-ink-700">Their THIKANO app is linked and now in Resident mode.</p>}
        </Dialog>
      ) : null}
      {dialog === 'movein' && invite === undefined ? (
        <Dialog title={`Move in ${lead.name}`} onClose={() => setDialog(null)}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const r = await moveIn.run({ orgId, bookingId: booking!.id, moveInDate: new Date(`${f.get('date')}T00:00:00+05:30`).getTime(), rentDueDay: Number(f.get('dueDay')), email: f.get('email') || null });
              if (r) setInvite(r.inviteCode);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Move-in date" name="date" type="date" required defaultValue={new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)} />
              <Field label="Rent due day" name="dueDay" type="number" min={1} max={28} defaultValue={5} />
            </div>
            <Field label="Gmail address (optional)" name="email" type="email" placeholder="name@gmail.com" />
            <p className="text-[12.5px] text-ink-500">Creates the resident and the first (pro-rated) invoice. If {lead.name} enquired from the app or you add their Gmail, their app switches to Resident mode automatically.</p>
            <FormError error={moveIn.error} />
            <Button type="submit" variant="success" className="w-full" disabled={moveIn.busy}>
              {moveIn.busy ? 'Moving in…' : 'Confirm move-in'}
            </Button>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}
