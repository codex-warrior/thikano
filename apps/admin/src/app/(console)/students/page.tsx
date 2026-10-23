import { Card, SectionHeader, StatTile } from '@thikano/web-ui';
import { getStudentsOverview } from '@thikano/server/platform';
import { PageHeader } from '@/components/table';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Students' };

function TopList({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <Card className="p-5">
      <SectionHeader title={title} />
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-500">No data yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(([k, v]) => (
            <li key={k}>
              <div className="flex justify-between text-[13.5px]">
                <span>{k}</span>
                <span className="tabular font-semibold">{v}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-navy-50">
                <div className="h-full rounded-full bg-navy-600" style={{ width: `${(v / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Aggregated, anonymous view of student demand — no individual search histories. */
export default async function StudentsPage() {
  const s = await requirePlatform();
  const o = await getStudentsOverview(s);
  return (
    <div className="space-y-6">
      <PageHeader title="Students" subtitle="Last 30 days · aggregated and anonymous" />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Search sessions" value={o.sessions} />
        <StatTile label="Searches" value={o.searches} />
        <StatTile label="Enquiries" value={o.leads} />
        <StatTile label="Applications & bookings" value={o.bookings} />
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <TopList title="Top areas" rows={o.topAreas} />
        <TopList title="Top colleges" rows={o.topColleges} />
        <TopList title="Budgets" rows={o.budgets} />
      </div>
    </div>
  );
}
