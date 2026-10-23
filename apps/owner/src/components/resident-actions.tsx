'use client';

import { useState } from 'react';
import { ArrowRightLeft, LogOut, MoreHorizontal } from 'lucide-react';
import { Button } from '@thikano/web-ui';
import { useAction } from '@/lib/use-action';
import { Dialog, Field, FormError, Select } from './form';

interface Props {
  orgId: string;
  residentId: string;
  name: string;
  status: string;
  freeBeds: { id: string; label: string }[];
}

export function ResidentActions({ orgId, residentId, name, status, freeBeds }: Props) {
  const [dialog, setDialog] = useState<null | 'notice' | 'moveout' | 'transfer'>(null);
  const [menu, setMenu] = useState(false);
  const notice = useAction<Record<string, unknown>>('startMoveOut');
  const out = useAction<Record<string, unknown>>('completeMoveOut');
  const transfer = useAction<Record<string, unknown>>('transferResident');
  const close = () => setDialog(null);
  return (
    <div className="relative">
      <button onClick={() => setMenu((m) => !m)} className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-navy-50" aria-label={`Actions for ${name}`}>
        <MoreHorizontal size={17} />
      </button>
      {menu ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-raised)]" onMouseLeave={() => setMenu(false)}>
          {status === 'active' ? <MenuItem onClick={() => (setMenu(false), setDialog('notice'))}>Start move-out notice</MenuItem> : null}
          <MenuItem onClick={() => (setMenu(false), setDialog('moveout'))}>
            <LogOut size={14} /> Complete move-out
          </MenuItem>
          <MenuItem onClick={() => (setMenu(false), setDialog('transfer'))}>
            <ArrowRightLeft size={14} /> Change room / bed
          </MenuItem>
        </div>
      ) : null}
      {dialog === 'notice' ? (
        <Dialog title={`Move-out notice · ${name}`} onClose={close}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (await notice.run({ orgId, residentId, moveOutDate: new Date(`${f.get('date')}T00:00:00+05:30`).getTime() })) close();
            }}
          >
            <Field label="Expected move-out date" name="date" type="date" required defaultValue={new Date(Date.now() + 30 * 86_400_000 + 330 * 60_000).toISOString().slice(0, 10)} />
            <p className="text-[12.5px] text-ink-500">The bed stays occupied and shows as “leaving soon” so you can find the next resident early.</p>
            <FormError error={notice.error} />
            <Button type="submit" className="w-full" disabled={notice.busy}>
              Save notice
            </Button>
          </form>
        </Dialog>
      ) : null}
      {dialog === 'moveout' ? (
        <Dialog title={`Complete move-out · ${name}`} onClose={close}>
          <p className="text-[14px] text-ink-700">The bed becomes available immediately and listings update automatically. {name} keeps their THIKANO account to find their next PG.</p>
          <FormError error={out.error} />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" disabled={out.busy} onClick={async () => (await out.run({ orgId, residentId })) && close()}>
              {out.busy ? 'Saving…' : 'Complete move-out'}
            </Button>
          </div>
        </Dialog>
      ) : null}
      {dialog === 'transfer' ? (
        <Dialog title={`Change bed · ${name}`} onClose={close}>
          {freeBeds.length === 0 ? (
            <p className="text-[14px] text-ink-500">There are no available beds right now.</p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (await transfer.run({ orgId, residentId, toBedId: f.get('bed') })) close();
              }}
            >
              <Select label="Move to" name="bed">
                {freeBeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
              <FormError error={transfer.error} />
              <Button type="submit" className="w-full" disabled={transfer.busy}>
                Move resident
              </Button>
            </form>
          )}
        </Dialog>
      ) : null}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-ink-700 hover:bg-navy-50">
      {children}
    </button>
  );
}
