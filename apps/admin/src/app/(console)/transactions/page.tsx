import { formatINR } from '@thikano/domain';
import { getEconomics } from '@thikano/server/platform';
import { fmtDate, PageHeader, Table } from '@/components/table';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Transactions' };

export default async function TransactionsPage() {
  const s = await requireAdmin();
  const { ledger } = await getEconomics(s);
  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" subtitle="Platform ledger — every delivered service order and how it was split." />
      <Table
        rows={ledger}
        rowKey={(l) => l.orderId}
        empty={{ title: 'No transactions yet' }}
        columns={[
          { key: 'o', header: 'Order', cell: (l) => <span className="font-mono text-[12.5px]">{l.orderId}</span> },
          { key: 'c', header: 'Service', cell: (l) => `${l.category} · ${l.providerId}` },
          { key: 'g', header: 'Gross', align: 'right', cell: (l) => formatINR(l.gross) },
          { key: 'p', header: 'Provider', align: 'right', cell: (l) => formatINR(l.provider) },
          { key: 't', header: 'Habistat', align: 'right', cell: (l) => formatINR(l.thikano) },
          { key: 'pa', header: 'Partner', align: 'right', cell: (l) => formatINR(l.partner) },
          { key: 'f', header: 'Fees', align: 'right', cell: (l) => formatINR(l.otherFees) },
          { key: 'd', header: 'Date', cell: (l) => fmtDate(l.createdAt, true) },
        ]}
      />
    </div>
  );
}
