import { Wrench } from 'lucide-react';
import { can, MAINTENANCE_CATEGORY_LABEL, type MaintenanceStatus } from '@thikano/domain';
import { Card, EmptyState, StatusPill, type Tone } from '@thikano/web-ui';
import { getMaintenance } from '@thikano/server/owner';
import { MaintenanceActions } from '@/components/ops-actions';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Maintenance' };

const TONE: Record<MaintenanceStatus, Tone> = { open: 'bad', assigned: 'info', in_progress: 'warn', resolved: 'ok', cancelled: 'neutral' };
const LABEL: Record<MaintenanceStatus, string> = { open: 'Open', assigned: 'Assigned', in_progress: 'In progress', resolved: 'Resolved', cancelled: 'Cancelled' };

export default async function MaintenancePage() {
  const { session, property } = await requireProperty();
  const rows = await getMaintenance(session, property.id);
  const canWrite = can(session.member, 'maintenance.write', property.id);
  const open = rows.filter((r) => r.issue.status !== 'resolved' && r.issue.status !== 'cancelled');
  const done = rows.filter((r) => r.issue.status === 'resolved').slice(0, 15);
  const counts = (['open', 'assigned', 'in_progress', 'resolved'] as MaintenanceStatus[]).map((s) => [s, rows.filter((r) => r.issue.status === s).length] as const);

  const list = (items: typeof rows) => (
    <Card className="divide-y divide-line">
      {items.map(({ issue, room }) => (
        <div key={issue.id} className="flex flex-wrap items-center gap-4 p-4">
          <div className="grid size-10 place-items-center rounded-full bg-warn-100 text-warn-600">
            <Wrench size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">
                {MAINTENANCE_CATEGORY_LABEL[issue.category]} · Room {room?.number ?? '—'}
              </p>
              <StatusPill tone={TONE[issue.status]}>{LABEL[issue.status]}</StatusPill>
            </div>
            <p className="mt-0.5 text-[13px] text-ink-500">
              {issue.description} · {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(issue.createdAt)}
            </p>
          </div>
          {canWrite ? <MaintenanceActions orgId={session.orgId} issueId={issue.id} status={issue.status} uid={session.uid} /> : null}
        </div>
      ))}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold">Maintenance</h1>
        <p className="mt-1 text-[14px] text-ink-500">Requests raised by residents — room and bed are filled in automatically.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {counts.map(([s, n]) => (
          <span key={s} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px]">
            {LABEL[s]} <b className="tabular">{n}</b>
          </span>
        ))}
      </div>
      {open.length === 0 ? <EmptyState icon={<Wrench size={20} />} title="No maintenance issues" body="Everything looks good." /> : list(open)}
      {done.length ? (
        <section>
          <h2 className="mb-3 text-[16px] font-bold">Recently resolved</h2>
          {list(done)}
        </section>
      ) : null}
    </div>
  );
}
