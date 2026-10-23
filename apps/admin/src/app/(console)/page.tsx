import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatINR } from '@thikano/domain';
import { buttonClass, Card, SectionHeader, StatTile, StatusPill, type Tone } from '@thikano/web-ui';
import { getPlatformMetrics, getPropertiesOverview } from '@thikano/server/platform';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Dashboard' };

const VERIFY_TONE: Record<string, Tone> = { verified: 'ok', submitted: 'warn', changes_requested: 'warn', draft: 'neutral', rejected: 'bad', suspended: 'bad' };
const VERIFY_LABEL: Record<string, string> = { verified: 'Verified', submitted: 'Pending review', changes_requested: 'Changes requested', draft: 'Draft', rejected: 'Rejected', suspended: 'Suspended' };

export default async function AdminDashboard() {
  const s = await requirePlatform();
  const [m, rows] = await Promise.all([getPlatformMetrics(s), getPropertiesOverview(s)]);
  const month = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(Date.now());
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px] font-bold">Platform overview</h1>
        <p className="mt-1 text-[14px] text-ink-500">THIKANO marketplace, residents and services — {month}.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Properties" value={m.properties} hint={`${m.verified} verified`} />
        <StatTile label="Owners" value={m.owners} />
        <StatTile label="Active residents" value={m.residents.toLocaleString('en-IN')} />
        <StatTile label="Students searching" value={m.studentsSearching} hint="unique sessions, last 7 days" />
        <StatTile label="Available beds (listed)" value={m.availableBeds} tone="ok" />
        <StatTile label="Bookings this month" value={m.bookingsThisMonth} hint={`${m.leadsThisMonth} leads`} />
        {m.serviceGmv != null ? <StatTile label="Service GMV" value={formatINR(m.serviceGmv, { compact: true })} hint="this month" /> : null}
        {m.thikanoRevenue != null ? <StatTile label="THIKANO revenue" value={formatINR(m.thikanoRevenue, { compact: true })} hint="service share, this month" tone="ok" /> : null}
      </section>

      {m.pending ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-warn-600/30 bg-warn-100/40 p-4">
          <p className="text-[14px]">
            <b className="font-semibold">
              {m.pending} propert{m.pending === 1 ? 'y' : 'ies'}
            </b>{' '}
            waiting for verification. Unverified properties are not publicly searchable.
          </p>
          <Link href="/verification" className={buttonClass('primary', 'sm')}>
            Review now <ArrowRight size={14} />
          </Link>
        </Card>
      ) : null}

      <section>
        <SectionHeader title="Properties" action={<Link href="/properties" className="text-[13px] font-semibold text-navy-700">All properties</Link>} />
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="border-b border-line text-[12px] uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Property</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Beds</th>
                <th className="px-4 py-3 text-right font-semibold">Occupancy</th>
                <th className="px-4 py-3 text-right font-semibold">Vacant</th>
                <th className="px-4 py-3 text-right font-semibold">Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.slice(0, 12).map(({ property: p, ownerName, summary, leads }) => (
                <tr key={p.id} className="hover:bg-canvas/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-[12px] text-ink-500">
                      {p.address?.locality}, {p.address?.city}
                    </div>
                  </td>
                  <td className="px-4 py-3">{ownerName}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={VERIFY_TONE[p.verification] ?? 'neutral'}>{VERIFY_LABEL[p.verification] ?? p.verification}</StatusPill>
                  </td>
                  <td className="tabular px-4 py-3 text-right">{summary.totalBeds}</td>
                  <td className="tabular px-4 py-3 text-right">{Math.round(summary.occupancyRate * 100)}%</td>
                  <td className="tabular px-4 py-3 text-right">{summary.availableBeds}</td>
                  <td className="tabular px-4 py-3 text-right">{leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
