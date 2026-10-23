import { notFound, redirect } from 'next/navigation';
import { can } from '@thikano/domain';
import { getRoomDetail, getStructure } from '@thikano/server/owner';
import { RoomForm } from '@/components/room-form';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Edit room' };

export default async function EditRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, property } = await requireProperty();
  if (!can(session.member, 'inventory.write', property.id)) redirect(`/rooms/${id}`);
  const [detail, { buildings, floors }] = await Promise.all([getRoomDetail(session, property, id), getStructure(session, property.id)]);
  if (!detail) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-[26px] font-bold">Edit Room {detail.room.number}</h1>
      <RoomForm orgId={session.orgId} propertyId={property.id} uid={session.uid} buildings={buildings} floors={floors} room={detail.room} />
    </div>
  );
}
