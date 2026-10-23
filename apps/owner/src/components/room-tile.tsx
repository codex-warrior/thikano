import Link from 'next/link';
import { formatINR, SHARING_LABEL, type ListingStatus, type Property, type Room } from '@thikano/domain';
import { RoomCard } from '@thikano/web-ui';
import { ListButton, ShareButton } from './room-actions';

/** Owner room card: the same RoomCard as public pages + Share / List actions. */
export function RoomTile({ room, property, listingStatus, canPublish }: { room: Room; property: Property; listingStatus: ListingStatus; canPublish: boolean }) {
  const inv = room.inventory ?? { availableBeds: 0, totalBeds: 0, upcomingVacancies: 0 };
  const verified = property.verification === 'verified';
  const blocked = property.verification === 'rejected' || property.verification === 'suspended';
  const target = { orgId: room.orgId, propertyId: room.propertyId, roomId: room.id };
  return (
    <div className="relative">
      <RoomCard
        room={{
          number: room.number,
          sharing: room.sharing,
          rent: room.rent,
          availableBeds: inv.availableBeds,
          totalBeds: inv.totalBeds,
          amenities: room.amenities,
          photoUrl: room.photos[0]?.thumbUrl ?? room.photos[0]?.url,
          listingStatus,
          upcomingVacancies: inv.upcomingVacancies,
          stats: room.listingIntent === 'listed' ? { views: room.stats?.views ?? 0, enquiries: room.stats?.enquiries ?? 0 } : undefined,
        }}
        actions={
          <>
            <Link href={`/rooms/${room.id}`} className="inline-flex h-8 items-center rounded-lg px-2.5 text-[13px] font-semibold text-navy-700 hover:bg-navy-50">
              View
            </Link>
            <ShareButton
              slug={room.publicSlug}
              title={`${property.name} — Room ${room.number}`}
              summary={`${SHARING_LABEL[room.sharing]} · ${formatINR(room.rent)}/month · ${inv.availableBeds} bed${inv.availableBeds === 1 ? '' : 's'} available`}
              target={target}
              disabledReason={verified ? undefined : 'Sharing opens once THIKANO verifies this property'}
            />
            {canPublish && (inv.availableBeds > 0 || room.listingIntent === 'listed') ? (
              <ListButton target={target} roomNumber={room.number} intent={room.listingIntent} disabledReason={blocked ? 'This property cannot be listed right now' : undefined} />
            ) : null}
          </>
        }
      />
    </div>
  );
}
