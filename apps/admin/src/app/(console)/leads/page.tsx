import { LEAD_STATUS_LABEL } from '@thikano/domain';
import { StatusPill } from '@thikano/web-ui';
import { getLeadsAcrossPlatform } from '@thikano/server/platform';
import { fmtDate, PageHeader, Table } from '@/components/table';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Leads' };

const SOURCE: Record<string, string> = { room_share_link: 'Room link', property_share_link: 'Property link', discover: 'Search', qr: 'QR', walk_in: 'Walk-in', other: 'Other' };

export default async function LeadsPage() {
  const s = await requirePlatform();
  const rows = await getLeadsAcrossPlatform(s);
  const bySource = rows.reduce<Record<string, number>>((a, r) => ((a[r.lead.source] = (a[r.lead.source] ?? 0) + 1), a), {});
  return (
    <div className="space-y-6">
      <PageHeader title="Leads" subtitle={`Latest ${rows.length} enquiries · ${Object.entries(bySource).map(([k, v]) => `${SOURCE[k] ?? k} ${v}`).join(' · ')}`} />
      <Table
        rows={rows}
        rowKey={(r) => r.lead.id}
        empty={{ title: 'No leads yet' }}
        columns={[
          { key: 'n', header: 'Student', cell: (r) => (<><div className="font-semibold">{r.lead.name}</div><div className="text-[12px] text-ink-500">{r.lead.phone}</div></>) },
          { key: 'p', header: 'Property', cell: (r) => r.propertyName },
          { key: 'src', header: 'Source', cell: (r) => SOURCE[r.lead.source] ?? r.lead.source },
          { key: 'st', header: 'Status', cell: (r) => <StatusPill tone={r.lead.status === 'converted' ? 'ok' : r.lead.status === 'new' ? 'brand' : 'neutral'}>{LEAD_STATUS_LABEL[r.lead.status]}</StatusPill> },
          { key: 'c', header: 'Created', cell: (r) => fmtDate(r.lead.createdAt, true) },
          { key: 'u', header: 'Updated', cell: (r) => fmtDate(r.lead.updatedAt, true) },
        ]}
      />
    </div>
  );
}
