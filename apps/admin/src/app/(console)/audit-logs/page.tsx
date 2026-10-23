import { getAuditLogs } from '@thikano/server/platform';
import { fmtDate, PageHeader, Table } from '@/components/table';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Audit Logs' };

export default async function AuditLogsPage() {
  const s = await requirePlatform();
  const rows = await getAuditLogs(s);
  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" subtitle="Append-only. Written by Cloud Functions in the same transaction as the change." />
      <Table
        rows={rows}
        rowKey={(r) => r.id}
        empty={{ title: 'No audit entries yet' }}
        columns={[
          { key: 'at', header: 'When', cell: (r) => fmtDate(r.at, true) },
          { key: 'a', header: 'Action', cell: (r) => <span className="font-mono text-[12.5px] font-semibold">{r.action}</span> },
          { key: 'actor', header: 'Actor', cell: (r) => (<><div className="font-mono text-[12px]">{r.actorUid}</div><div className="text-[11.5px] text-ink-500">{r.actorRole}</div></>) },
          { key: 'e', header: 'Entity', cell: (r) => <span className="font-mono text-[12px]">{r.entity}/{r.entityId}</span> },
          { key: 'm', header: 'Details', cell: (r) => <span className="line-clamp-2 max-w-xs font-mono text-[11.5px] text-ink-500">{Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata) : '—'}</span> },
        ]}
      />
    </div>
  );
}
