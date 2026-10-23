import { IndianRupee } from 'lucide-react';
import { can, formatINR, INVOICE_STATUS_LABEL, type InvoiceStatus } from '@thikano/domain';
import { Card, EmptyState, StatTile, StatusPill, type Tone } from '@thikano/web-ui';
import { getInvoices, istPeriod } from '@thikano/server/owner';
import { GenerateInvoicesButton, RecordPaymentButton } from '@/components/rent-actions';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Rent & Payments' };

const TONE: Record<InvoiceStatus, Tone> = { upcoming: 'neutral', due: 'info', partially_paid: 'warn', paid: 'ok', overdue: 'bad' };
const METHOD: Record<string, string> = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank', gateway: 'Online' };

export default async function RentPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { session, property } = await requireProperty();
  const sp = await searchParams;
  const period = sp.period && /^20\d{2}-\d{2}$/.test(sp.period) ? sp.period : istPeriod();
  const data = await getInvoices(session, property.id, period);
  const canCollect = can(session.member, 'rent.collect', property.id);
  const [y, m] = period.split('-').map(Number) as [number, number];
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
  const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(Date.UTC(y, m - 1, 15));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold">Rent & Payments</h1>
          <div className="mt-1 flex items-center gap-3 text-[14px] text-ink-500">
            <a href={`/rent?period=${prev}`} className="font-semibold text-navy-700" aria-label="Previous month">
              ‹
            </a>
            {monthLabel}
            <a href={`/rent?period=${next}`} className="font-semibold text-navy-700" aria-label="Next month">
              ›
            </a>
          </div>
        </div>
        {canCollect ? <GenerateInvoicesButton orgId={session.orgId} propertyId={property.id} period={period} /> : null}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Billed" value={formatINR(data.billed, { compact: true })} hint={`${data.rows.length} residents`} />
        <StatTile label="Collected" value={formatINR(data.collected, { compact: true })} tone="ok" hint={data.billed ? `${Math.round((data.collected / data.billed) * 100)}%` : undefined} />
        <StatTile label="Outstanding" value={formatINR(data.outstanding, { compact: true })} tone={data.outstanding ? 'bad' : undefined} />
        <StatTile label="Overdue" value={data.rows.filter((r) => r.status === 'overdue').length} tone="bad" hint="residents" />
      </section>

      {data.rows.length === 0 ? (
        <EmptyState icon={<IndianRupee size={20} />} title="No rent for this month yet" body="Invoices are created automatically on the 1st. You can also generate them now." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="border-b border-line text-[12px] uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Resident</th>
                <th className="px-4 py-3 font-semibold">Due date</th>
                <th className="px-4 py-3 text-right font-semibold">Rent</th>
                <th className="px-4 py-3 text-right font-semibold">Paid</th>
                <th className="px-4 py-3 text-right font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rows.map(({ invoice: i, status, due, resident }) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-semibold">{resident?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-500">{new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(i.dueDate)}</td>
                  <td className="tabular px-4 py-3 text-right">{formatINR(i.amount + i.lateFee)}</td>
                  <td className="tabular px-4 py-3 text-right">{formatINR(i.paid)}</td>
                  <td className="tabular px-4 py-3 text-right font-semibold">{due ? formatINR(due) : '—'}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={TONE[status]}>{INVOICE_STATUS_LABEL[status]}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-right">{canCollect && due > 0 ? <RecordPaymentButton orgId={session.orgId} invoiceId={i.id} name={resident?.name ?? 'Resident'} due={due} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {data.recentPayments.length ? (
        <section>
          <h2 className="mb-3 text-[16px] font-bold">Recent payments</h2>
          <Card className="divide-y divide-line">
            {data.recentPayments.map(({ payment: p, resident }) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13.5px]">
                <span className="font-medium">{resident?.name ?? '—'}</span>
                <span className="text-ink-500">
                  {METHOD[p.method] ?? p.method} · {p.receiptNo}
                  {(p as typeof p & { mode?: string }).mode === 'test' ? ' · test mode' : ''}
                </span>
                <span className="tabular font-semibold text-ok-600">{formatINR(p.amount)}</span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
