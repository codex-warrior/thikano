import { redirect } from 'next/navigation';
import { STAFF_PERMISSION_LABEL } from '@thikano/domain';
import { Avatar, Card, StatusPill } from '@thikano/web-ui';
import { getTeam } from '@thikano/server/owner';
import { AddMemberButton, RemoveMemberButton } from '@/components/ops-actions';
import { currentProperty } from '@/lib/session';

export const metadata = { title: 'Staff' };

export default async function StaffPage() {
  const { session, properties } = await currentProperty();
  if (session.member.role !== 'owner') redirect('/');
  const team = await getTeam(session);
  const pName = new Map(properties.map((p) => [p.id, p.name]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold">Staff</h1>
          <p className="mt-1 text-[14px] text-ink-500">Give managers and staff exactly the access they need.</p>
        </div>
        <AddMemberButton orgId={session.orgId} properties={properties.map((p) => ({ id: p.id, name: p.name }))} />
      </div>
      <Card className="divide-y divide-line">
        {team.map((m) => (
          <div key={m.uid} className="flex flex-wrap items-center gap-4 p-4">
            <Avatar name={m.displayName || 'Member'} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{m.displayName}</p>
                <StatusPill tone={m.role === 'owner' ? 'brand' : m.role === 'manager' ? 'navy' : 'neutral'} dot={false}>
                  {m.role}
                </StatusPill>
              </div>
              <p className="mt-0.5 text-[12.5px] text-ink-500">
                {m.propertyIds === null ? 'All properties' : m.propertyIds.map((p) => pName.get(p) ?? p).join(', ')}
                {m.role === 'staff' && m.permissions?.length ? ` · ${m.permissions.map((p) => STAFF_PERMISSION_LABEL[p]).join(', ')}` : ''}
              </p>
            </div>
            {m.role !== 'owner' ? <RemoveMemberButton orgId={session.orgId} uid={m.uid} name={m.displayName} /> : null}
          </div>
        ))}
      </Card>
    </div>
  );
}
