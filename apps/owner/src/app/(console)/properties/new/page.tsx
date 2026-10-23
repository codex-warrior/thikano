import { redirect } from 'next/navigation';
import { PropertyForm } from '@/components/property-form';
import { requireOwner } from '@/lib/session';

export const metadata = { title: 'Add property' };

export default async function NewPropertyPage() {
  const session = await requireOwner();
  if (!(session.member.role === 'owner' || (session.member.role === 'manager' && session.member.propertyIds === null))) redirect('/properties');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold">Add property</h1>
        <p className="mt-1 text-[14px] text-ink-500">Tell students about your PG. You can add rooms and beds right after.</p>
      </div>
      <PropertyForm orgId={session.orgId} uid={session.uid} />
    </div>
  );
}
