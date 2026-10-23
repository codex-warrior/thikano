import { StatusPill, type Tone } from '@thikano/web-ui';
import { getPropertiesOverview } from '@thikano/server/platform';
import { SuspendButton } from '@/components/admin-actions';
import { PageHeader, Table } from '@/components/table';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Properties' };

const TONE: Record<string, Tone> = { verified: 'ok', submitted: 'warn', changes_requested: 'warn', draft: 'neutral', rejected: 'bad', suspended: 'bad' };

export default async function PropertiesPage() {
  const s = await requirePlatform();
  const rows = await getPropertiesOverview(s);
  return (
    <div className="space-y-6">
      <PageHeader title="Properties" subtitle={`${rows.length} properties · ${rows.filter((r) => r.property.verification === 'verified').length} verified`} />
      <Table
        rows={rows}
        rowKey={(r) => r.property.id}
        empty={{ title: 'No properties yet' }}
        columns={[
          { key: 'p', header: 'Property', cell: (r) => (<><div className="font-semibold">{r.property.name}</div><div className="text-[12px] text-ink-500">{r.property.address?.locality}, {r.property.address?.city} · {r.orgName}</div></>) },
          { key: 'o', header: 'Owner', cell: (r) => r.ownerName },
          { key: 's', header: 'Status', cell: (r) => <StatusPill tone={TONE[r.property.verification] ?? 'neutral'}>{r.property.verification.replace('_', ' ')}</StatusPill> },
          { key: 'b', header: 'Beds', align: 'right', cell: (r) => r.summary.totalBeds },
          { key: 'occ', header: 'Occupancy', align: 'right', cell: (r) => `${Math.round(r.summary.occupancyRate * 100)}%` },
          { key: 'v', header: 'Vacant', align: 'right', cell: (r) => r.summary.availableBeds },
          { key: 'l', header: 'Leads', align: 'right', cell: (r) => r.leads },
          {
            key: 'a',
            header: '',
            align: 'right',
            cell: (r) =>
              s.role === 'platform_admin' && (r.property.verification === 'verified' || r.property.verification === 'suspended') ? (
                <SuspendButton kind="property" orgId={r.property.orgId} propertyId={r.property.id} suspended={r.property.verification === 'suspended'} label={r.property.name} />
              ) : null,
          },
        ]}
      />
    </div>
  );
}
