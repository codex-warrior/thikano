import { formatINR } from '@thikano/domain';
import { StatusPill } from '@thikano/web-ui';
import { getResidentsAcrossPlatform } from '@thikano/server/platform';
import { fmtDate, PageHeader, Table } from '@/components/table';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Residents' };

export default async function ResidentsPage() {
  const s = await requirePlatform();
  const rows = await getResidentsAcrossPlatform(s);
  return (
    <div className="space-y-6">
      <PageHeader title="Residents" subtitle={`${rows.length} active stays shown${s.role === 'platform_support' ? ' · phone numbers masked for support staff' : ''}`} />
      <Table
        rows={rows}
        rowKey={(r) => r.id}
        empty={{ title: 'No active residents' }}
        columns={[
          { key: 'n', header: 'Resident', cell: (r) => (<><div className="font-semibold">{r.name}</div><div className="text-[12px] text-ink-500">{r.phone}</div></>) },
          { key: 'app', header: 'App', cell: (r) => <StatusPill tone={r.uid ? 'ok' : 'neutral'}>{r.uid ? 'Linked' : 'Not linked'}</StatusPill> },
          { key: 'st', header: 'Status', cell: (r) => <StatusPill tone={r.status === 'notice' ? 'warn' : 'ok'}>{r.status === 'notice' ? 'Leaving' : 'Active'}</StatusPill> },
          { key: 'rent', header: 'Rent', align: 'right', cell: (r) => formatINR(r.rent) },
          { key: 'since', header: 'Since', cell: (r) => fmtDate(r.moveInDate) },
        ]}
      />
    </div>
  );
}
