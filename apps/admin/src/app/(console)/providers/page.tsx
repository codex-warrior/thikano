import { StatusPill } from '@thikano/web-ui';
import { getEconomics } from '@thikano/server/platform';
import { PageHeader, Table } from '@/components/table';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Services & Providers' };

const ADAPTER: Record<string, string> = { mock: 'Catalog (partner console)', dwarpar: 'Dwarpar API' };

export default async function ProvidersPage() {
  const s = await requireAdmin();
  const { providers } = await getEconomics(s);
  return (
    <div className="space-y-6">
      <PageHeader title="Services & Providers" subtitle="Every provider plugs in through the same ServiceProvider interface." />
      <Table
        rows={providers}
        rowKey={(p) => p.id}
        empty={{ title: 'No providers yet' }}
        columns={[
          { key: 'n', header: 'Provider', cell: (p) => <span className="font-semibold">{p.name}</span> },
          { key: 'c', header: 'Services', cell: (p) => p.categories.join(', ') },
          { key: 'a', header: 'Integration', cell: (p) => ADAPTER[p.adapter] ?? p.adapter },
          { key: 's', header: 'Status', cell: (p) => <StatusPill tone={p.status === 'active' ? 'ok' : p.status === 'pending' ? 'warn' : 'neutral'}>{p.status}</StatusPill> },
        ]}
      />
      <p className="text-[12.5px] text-ink-400">Dwarpar live ordering requires DWARPAR_API_BASE and DWARPAR_API_KEY on Cloud Functions. Until then the adapter refuses live calls rather than pretending.</p>
    </div>
  );
}
