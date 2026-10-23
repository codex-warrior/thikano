import { DoorOpen } from 'lucide-react';
import { can, formatINR } from '@thikano/domain';
import { Card, EmptyState, StatTile } from '@thikano/web-ui';
import { getDashboard, getRooms } from '@thikano/server/owner';
import { RoomTile } from '@/components/room-tile';
import { ListAllButton } from '@/components/room-actions';
import { InsightsCard } from '@/components/insights';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Vacancies' };

export default async function VacanciesPage() {
  const { session, property } = await requireProperty();
  const [d, rows] = await Promise.all([getDashboard(session, property), getRooms(session, property)]);
  const vacant = rows.filter((r) => (r.room.inventory?.availableBeds ?? 0) > 0 || (r.room.inventory?.upcomingVacancies ?? 0) > 0);
  const canPublish = can(session.member, 'listings.publish', property.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold">Vacancies</h1>
          <p className="mt-1 text-[14px] text-ink-500">Every empty bed, ready to share or list in one tap.</p>
        </div>
        {canPublish ? <ListAllButton orgId={session.orgId} propertyId={property.id} count={d.eligibleToList.length} /> : null}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Vacant beds" value={d.vacantBeds} />
        <StatTile label="Potential monthly revenue" value={formatINR(d.vacantRevenue)} tone={d.vacantRevenue ? 'warn' : undefined} hint="Not being earned today" />
        <StatTile label="Leaving soon" value={d.leaving.length} hint="Beds freeing up" />
        <StatTile label="New enquiries" value={d.newLeads.length} tone={d.newLeads.length ? 'ok' : undefined} />
      </section>

      <InsightsCard orgId={session.orgId} propertyId={property.id} />

      {property.verification !== 'verified' ? (
        <Card className="border-warn-600/30 bg-warn-100/40 p-4 text-[13.5px]">Listed rooms become visible to students once THIKANO verifies {property.name}.</Card>
      ) : null}

      {vacant.length === 0 ? (
        <EmptyState icon={<DoorOpen size={20} />} title="No vacant rooms" body="Your property is fully occupied." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {vacant.map(({ room, listingStatus }) => (
            <RoomTile key={room.id} room={room} property={property} listingStatus={listingStatus} canPublish={canPublish} />
          ))}
        </div>
      )}
    </div>
  );
}
