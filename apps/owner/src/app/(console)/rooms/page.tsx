import Link from 'next/link';
import { BedDouble, Plus } from 'lucide-react';
import { can } from '@thikano/domain';
import { buttonClass, EmptyState, StatusPill } from '@thikano/web-ui';
import { getRooms } from '@thikano/server/owner';
import { RoomTile } from '@/components/room-tile';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Rooms & Beds' };

export default async function RoomsPage() {
  const { session, property } = await requireProperty();
  const rows = await getRooms(session, property);
  const canWrite = can(session.member, 'inventory.write', property.id);
  const canPublish = can(session.member, 'listings.publish', property.id);

  const groups = new Map<string, { label: string; rows: typeof rows }>();
  for (const r of rows) {
    const key = r.floor?.id ?? 'none';
    if (!groups.has(key)) groups.set(key, { label: r.building && r.floor ? `${r.building.name} · ${r.floor.label} floor` : 'Unassigned', rows: [] });
    groups.get(key)!.rows.push(r);
  }
  const beds = rows.flatMap((r) => r.beds);
  const avail = beds.filter((b) => b.status === 'available').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold">Rooms & Beds</h1>
          <p className="mt-1 text-[14px] text-ink-500">
            {rows.length} rooms · {beds.length} beds · <span className="font-semibold text-ok-600">{avail} available</span> · {beds.filter((b) => b.status === 'occupied').length} occupied
          </p>
        </div>
        {canWrite ? (
          <Link href="/rooms/new" className={buttonClass('primary')}>
            <Plus size={16} /> Add room
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<BedDouble size={20} />}
          title="No rooms yet"
          body="Add your first room with photos, rent and beds. It powers your room cards, share links and listings."
          action={canWrite ? <Link href="/rooms/new" className={buttonClass('primary', 'sm')}>Add room</Link> : undefined}
        />
      ) : (
        [...groups.values()].map((g) => (
          <section key={g.label}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-[15px] font-bold">{g.label}</h2>
              <StatusPill tone="neutral" dot={false}>
                {g.rows.length} rooms
              </StatusPill>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.rows.map(({ room, listingStatus }) => (
                <RoomTile key={room.id} room={room} property={property} listingStatus={listingStatus} canPublish={canPublish} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
