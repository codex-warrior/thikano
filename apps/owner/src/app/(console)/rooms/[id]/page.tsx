import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { can, conversionRate, formatINR, LISTING_STATUS_LABEL, ROOM_AMENITY_LABEL, SHARING_LABEL } from '@thikano/domain';
import { buttonClass, Card, StatTile, StatusPill } from '@thikano/web-ui';
import { getRoomDetail } from '@thikano/server/owner';
import { BedManager } from '@/components/bed-manager';
import { ListButton, ShareButton } from '@/components/room-actions';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Room' };

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, property } = await requireProperty();
  const d = await getRoomDetail(session, property, id);
  if (!d) notFound();
  const { room, beds, listingStatus } = d;
  const inv = room.inventory ?? { availableBeds: 0, totalBeds: 0 };
  const stats = room.stats ?? { views: 0, shares: 0, enquiries: 0, applications: 0, bookings: 0 };
  const m = session.member;
  const target = { orgId: session.orgId, propertyId: property.id, roomId: room.id };
  const occupants = Object.fromEntries(Object.entries(d.occupants).map(([k, v]) => [k, v ? { name: v.name, status: v.status } : null]));

  return (
    <div className="space-y-6">
      <Link href="/rooms" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-500 hover:text-navy-700">
        <ArrowLeft size={14} /> Rooms & Beds
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-wider text-ink-400">
            {d.building?.name} · {d.floor?.label} floor
          </p>
          <h1 className="text-[28px] font-bold">Room {room.number}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-ink-500">
            {SHARING_LABEL[room.sharing]} · <b className="text-ink-900">{formatINR(room.rent)}</b>/month · deposit {formatINR(room.deposit)}
            <StatusPill tone={inv.availableBeds ? 'ok' : 'navy'}>{inv.availableBeds ? `${inv.availableBeds} of ${inv.totalBeds} beds available` : 'Fully occupied'}</StatusPill>
            <StatusPill tone={listingStatus === 'published' ? 'brand' : 'neutral'}>{LISTING_STATUS_LABEL[listingStatus]}</StatusPill>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ShareButton slug={room.publicSlug} title={`${property.name} — Room ${room.number}`} summary={`${SHARING_LABEL[room.sharing]} · ${formatINR(room.rent)}/month · ${inv.availableBeds} beds available`} target={target} disabledReason={property.verification === 'verified' ? undefined : 'Sharing opens once THIKANO verifies this property'} />
          {can(m, 'listings.publish', property.id) ? <ListButton target={target} roomNumber={room.number} intent={room.listingIntent} /> : null}
          {can(m, 'inventory.write', property.id) ? (
            <Link href={`/rooms/${room.id}/edit`} className={buttonClass('secondary', 'sm')}>
              <Pencil size={14} /> Edit
            </Link>
          ) : null}
        </div>
      </div>

      {room.photos.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {room.photos.map((p) => (
            <img key={p.id} src={p.thumbUrl ?? p.url} alt={`Room ${room.number}`} className="h-36 w-52 shrink-0 rounded-xl object-cover" loading="lazy" />
          ))}
        </div>
      ) : (
        <Card className="p-4 text-[13.5px] text-ink-500">No photos yet — rooms with photos get far more enquiries. Add some from Edit.</Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <h2 className="text-[16px] font-bold">Beds</h2>
          <p className="text-[12.5px] text-ink-500">Availability on THIKANO updates automatically from these beds.</p>
          <div className="mt-2">
            <BedManager
              orgId={session.orgId}
              propertyId={property.id}
              roomId={room.id}
              uid={session.uid}
              rent={room.rent}
              deposit={room.deposit}
              beds={beds}
              occupants={occupants}
              canWrite={can(m, 'inventory.write', property.id)}
              canAssign={can(m, 'residents.write', property.id)}
            />
          </div>
        </Card>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Views" value={stats.views} />
            <StatTile label="Shares" value={stats.shares} />
            <StatTile label="Enquiries" value={stats.enquiries} hint={stats.views ? `${(conversionRate(stats.enquiries, stats.views) * 100).toFixed(1)}% of views` : undefined} />
            <StatTile label="Applications" value={stats.applications} hint={`${stats.bookings} moved in`} />
          </div>
          <Card className="p-5">
            <h2 className="text-[15px] font-bold">Amenities</h2>
            <p className="mt-2 text-[13.5px] text-ink-700">{room.amenities.map((a) => ROOM_AMENITY_LABEL[a]).join(' • ') || 'None added'}</p>
            {room.description ? <p className="mt-3 text-[13.5px] text-ink-500">{room.description}</p> : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
