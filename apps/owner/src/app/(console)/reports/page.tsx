import { conversionRate, formatINR } from '@thikano/domain';
import { Card, SectionHeader, StatTile } from '@thikano/web-ui';
import { getDashboard, getRooms } from '@thikano/server/owner';
import { InsightsCard } from '@/components/insights';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const { session, property } = await requireProperty();
  const [d, rows] = await Promise.all([getDashboard(session, property), getRooms(session, property)]);
  const listed = rows.filter((r) => r.room.listingIntent === 'listed');
  const zero = { views: 0, shares: 0, enquiries: 0, applications: 0, bookings: 0 };
  const totals = listed.reduce((a, r) => {
    const s = r.room.stats ?? zero;
    return { views: a.views + s.views, shares: a.shares + s.shares, enquiries: a.enquiries + s.enquiries, applications: a.applications + s.applications, bookings: a.bookings + s.bookings };
  }, zero);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px] font-bold">Reports</h1>
        <p className="mt-1 text-[14px] text-ink-500">{property.name} — occupancy, listings and demand. All numbers are measured, not estimated.</p>
      </div>
      <section>
        <SectionHeader title="Occupancy" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Occupancy rate" value={`${d.totalBeds ? Math.round((d.occupied / d.totalBeds) * 100) : 0}%`} hint={`${d.occupied} of ${d.totalBeds} beds`} />
          <StatTile label="Vacant beds" value={d.vacantBeds} hint={`${formatINR(d.vacantRevenue)}/month`} tone={d.vacantBeds ? 'warn' : 'ok'} />
          <StatTile label="Leaving soon" value={d.leaving.length} />
          {d.rent ? <StatTile label="Rent collection" value={`${d.rent.billed ? Math.round((d.rent.collected / d.rent.billed) * 100) : 0}%`} hint="this month" /> : null}
        </div>
      </section>
      <section>
        <SectionHeader title="Listing performance" subtitle={`${listed.length} listed rooms`} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label="Views" value={totals.views} />
          <StatTile label="Shares" value={totals.shares} />
          <StatTile label="Enquiries" value={totals.enquiries} hint={`${(conversionRate(totals.enquiries, totals.views) * 100).toFixed(1)}% of views`} />
          <StatTile label="Applications" value={totals.applications} />
          <StatTile label="Moved in" value={totals.bookings} />
        </div>
        {listed.length ? (
          <Card className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13.5px]">
              <thead className="border-b border-line text-[12px] uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3 text-right">Views</th>
                  <th className="px-4 py-3 text-right">Enquiries</th>
                  <th className="px-4 py-3 text-right">Conversion</th>
                  <th className="px-4 py-3 text-right">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...listed]
                  .sort((a, b) => (b.room.stats?.views ?? 0) - (a.room.stats?.views ?? 0))
                  .map(({ room }) => (
                    <tr key={room.id}>
                      <td className="px-4 py-2.5 font-medium">Room {room.number}</td>
                      <td className="tabular px-4 py-2.5 text-right">{room.stats?.views ?? 0}</td>
                      <td className="tabular px-4 py-2.5 text-right">{room.stats?.enquiries ?? 0}</td>
                      <td className="tabular px-4 py-2.5 text-right">{(conversionRate(room.stats?.enquiries ?? 0, room.stats?.views ?? 0) * 100).toFixed(1)}%</td>
                      <td className="tabular px-4 py-2.5 text-right">{room.inventory?.availableBeds ?? 0}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
        ) : null}
      </section>
      <section>
        <SectionHeader title="Student demand" subtitle="From real Habistat searches near your property" />
        <InsightsCard orgId={session.orgId} propertyId={property.id} />
      </section>
    </div>
  );
}
