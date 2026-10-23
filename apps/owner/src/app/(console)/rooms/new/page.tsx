import { redirect } from 'next/navigation';
import { can } from '@thikano/domain';
import { getStructure } from '@thikano/server/owner';
import { RoomForm } from '@/components/room-form';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Add room' };

export default async function NewRoomPage() {
  const { session, property } = await requireProperty();
  if (!can(session.member, 'inventory.write', property.id)) redirect('/rooms');
  const { buildings, floors } = await getStructure(session, property.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold">Add room</h1>
        <p className="mt-1 text-[14px] text-ink-500">{property.name} · Enter it once — it powers your room card, share link and listing.</p>
      </div>
      <RoomForm orgId={session.orgId} propertyId={property.id} uid={session.uid} buildings={buildings} floors={floors} />
    </div>
  );
}
