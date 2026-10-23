import { Card, SectionHeader, StatTile } from '@thikano/web-ui';
import { getPlatformDaily, getPlatformMetrics } from '@thikano/server/platform';
import { PageHeader } from '@/components/table';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Reports & Analytics' };

const SERIES = [
  { key: 'searches', label: 'Searches' },
  { key: 'views', label: 'Room views' },
  { key: 'enquiries', label: 'Enquiries' },
  { key: 'serviceOrders', label: 'Service orders' },
] as const;

/** Daily platform funnel from analyticsDaily aggregates (no raw personal data). */
export default async function AnalyticsPage() {
  const s = await requirePlatform();
  const [daily, m] = await Promise.all([getPlatformDaily(s, 30), getPlatformMetrics(s)]);
  const sum = (k: (typeof SERIES)[number]['key']) => daily.reduce((a, d) => a + d[k], 0);
  return (
    <div className="space-y-8">
      <PageHeader title="Reports & Analytics" subtitle="Last 30 days, India time" />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {SERIES.map((x) => (
          <StatTile key={x.key} label={x.label} value={sum(x.key).toLocaleString('en-IN')} />
        ))}
        <StatTile label="View → enquiry" value={`${sum('views') ? ((sum('enquiries') / sum('views')) * 100).toFixed(1) : '0'}%`} hint={`${m.availableBeds} beds available now`} />
      </section>
      {SERIES.map((x) => {
        const max = Math.max(1, ...daily.map((d) => d[x.key]));
        return (
          <section key={x.key}>
            <SectionHeader title={x.label} />
            <Card className="p-4">
              <div className="flex h-28 items-end gap-1" role="img" aria-label={`${x.label} per day`}>
                {daily.map((d) => (
                  <div key={d.day} className="group relative flex-1">
                    <div className="rounded-t bg-navy-600/80 transition-colors group-hover:bg-navy-700" style={{ height: `${Math.max(2, (d[x.key] / max) * 100)}%` }} title={`${d.day}: ${d[x.key]}`} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-ink-400">
                <span>{daily[0]?.day}</span>
                <span>{daily.at(-1)?.day}</span>
              </div>
            </Card>
          </section>
        );
      })}
    </div>
  );
}
