import { formatINR } from '@thikano/domain';
import { StatTile, StatusPill } from '@thikano/web-ui';
import { getEconomics } from '@thikano/server/platform';
import { PageHeader, Table } from '@/components/table';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Revenue' };

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 1 : 0)}%`;

export default async function RevenuePage() {
  const s = await requireAdmin();
  const { rules, ledger } = await getEconomics(s);
  const t = ledger.reduce((a, l) => ({ gross: a.gross + l.gross, thikano: a.thikano + l.thikano, partner: a.partner + l.partner, provider: a.provider + l.provider }), { gross: 0, thikano: 0, partner: 0, provider: 0 });
  return (
    <div className="space-y-6">
      <PageHeader title="Revenue" subtitle={`Last ${ledger.length} delivered orders · splits computed once at delivery with the rule in effect`} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Service GMV" value={formatINR(t.gross, { compact: true })} />
        <StatTile label="THIKANO share" value={formatINR(t.thikano, { compact: true })} tone="ok" hint={t.gross ? `${((t.thikano / t.gross) * 100).toFixed(1)}% take rate` : undefined} />
        <StatTile label="Partner (owner) share" value={formatINR(t.partner, { compact: true })} />
        <StatTile label="Provider share" value={formatINR(t.provider, { compact: true })} />
      </section>
      <h2 className="text-[16px] font-bold">Revenue share rules</h2>
      <Table
        rows={rules}
        rowKey={(r) => r.id}
        empty={{ title: 'No rules' }}
        columns={[
          { key: 'id', header: 'Rule', cell: (r) => <span className="font-mono text-[12.5px]">{r.id}</span> },
          { key: 'm', header: 'Applies to', cell: (r) => [r.match.category, r.match.providerId, r.match.orgId, r.match.propertyId].filter(Boolean).join(' · ') || 'Default (all)' },
          { key: 'p', header: 'Provider', align: 'right', cell: (r) => pct(r.providerBps) },
          { key: 't', header: 'THIKANO', align: 'right', cell: (r) => pct(r.thikanoBps) },
          { key: 'pa', header: 'Partner', align: 'right', cell: (r) => pct(r.partnerBps) },
          { key: 'f', header: 'Fees', align: 'right', cell: (r) => pct(r.otherFeesBps) },
          { key: 's', header: 'Status', cell: (r) => <StatusPill tone={r.active ? 'ok' : 'neutral'}>{r.active ? 'Active' : 'Off'}</StatusPill> },
        ]}
      />
      <p className="text-[12.5px] text-ink-400">Rules are edited through the audited upsertRevenueRule function; shares must total 100%. The most specific active rule wins (property → org → provider → category → default).</p>
    </div>
  );
}
