import { Sparkles } from 'lucide-react';
import { formatINR, type ServiceCategory } from '@thikano/domain';
import { Card, EmptyState, StatTile } from '@thikano/web-ui';
import { getEarnings, istPeriod } from '@thikano/server/owner';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Services & Earnings' };

const LABEL: Record<ServiceCategory, string> = { food: 'Food', laundry: 'Laundry', cleaning: 'Cleaning', groceries: 'Groceries', pharmacy: 'Pharmacy', printing: 'Printing', courier: 'Courier', repairs: 'Repairs', other: 'Other' };

export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { session, property } = await requireProperty();
  const sp = await searchParams;
  const period = sp.period && /^20\d{2}-\d{2}$/.test(sp.period) ? sp.period : istPeriod();
  const e = await getEarnings(session, property.id, period);
  const [y, m] = period.split('-').map(Number) as [number, number];
  const label = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(Date.UTC(y, m - 1, 15));
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold">Habistat Partner Share</h1>
        <p className="mt-1 text-[14px] text-ink-500">
          Your share of services your residents order through Habistat · {label} ·{' '}
          <a className="font-semibold text-navy-700" href={`/earnings?period=${prev}`}>
            previous month
          </a>
        </p>
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Earned this month" value={formatINR(e.total)} tone="ok" icon={<Sparkles size={16} />} />
        <StatTile label="Orders" value={e.orders} />
        <StatTile label="Average per order" value={formatINR(e.orders ? Math.round(e.total / e.orders) : 0)} />
      </section>
      {e.total === 0 ? (
        <EmptyState icon={<Sparkles size={20} />} title="No service earnings yet" body="When residents order food, laundry or cleaning in Habistat, your share appears here automatically." />
      ) : (
        <Card className="divide-y divide-line">
          {Object.entries(e.byCategory)
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between px-5 py-3.5 text-[14px]">
                <span>{LABEL[cat as ServiceCategory] ?? cat}</span>
                <span className="tabular font-semibold">{formatINR(amt ?? 0)}</span>
              </div>
            ))}
        </Card>
      )}
      <p className="text-[12.5px] text-ink-400">Shares differ by service and are set in your Habistat partner agreement. Payouts are settled monthly.</p>
    </div>
  );
}
