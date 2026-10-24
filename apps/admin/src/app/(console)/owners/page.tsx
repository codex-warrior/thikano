import { StatusPill } from '@thikano/web-ui';
import { getOwners } from '@thikano/server/platform';
import { fmtDate, PageHeader, Table } from '@/components/table';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Owners' };

export default async function OwnersPage() {
  const s = await requirePlatform();
  const rows = await getOwners(s);
  return (
    <div className="space-y-6">
      <PageHeader title="Owners" subtitle={`${rows.length} businesses on Habistat`} />
      <Table
        rows={rows}
        rowKey={(r) => r.org.id}
        empty={{ title: 'No owners yet' }}
        columns={[
          { key: 'owner', header: 'Owner', cell: (r) => (<><div className="font-semibold">{r.ownerName}</div><div className="text-[12px] text-ink-500">{r.org.name}</div></>) },
          { key: 'props', header: 'Properties', align: 'right', cell: (r) => r.properties },
          { key: 'res', header: 'Residents', align: 'right', cell: (r) => r.residents },
          { key: 'vac', header: 'Vacancies', align: 'right', cell: (r) => r.vacancies },
          { key: 'ver', header: 'Verification', cell: (r) => <StatusPill tone={r.org.verification === 'verified' ? 'ok' : 'neutral'}>{r.org.verification}</StatusPill> },
          { key: 'status', header: 'Status', cell: (r) => <StatusPill tone={r.org.status === 'active' ? 'ok' : 'bad'}>{r.org.status}</StatusPill> },
          { key: 'joined', header: 'Joined', cell: (r) => fmtDate(r.org.createdAt) },
        ]}
      />
    </div>
  );
}
