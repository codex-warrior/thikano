import Link from 'next/link';
import { Building2, Plus } from 'lucide-react';
import { can } from '@thikano/domain';
import { buttonClass, Card, StatusPill, type Tone } from '@thikano/web-ui';
import { PropertyForm } from '@/components/property-form';
import { SubmitVerificationButton } from '@/components/verification';
import { currentProperty } from '@/lib/session';

export const metadata = { title: 'Properties' };

const STATUS: Record<string, { label: string; tone: Tone; body: string }> = {
  draft: { label: 'Not submitted', tone: 'neutral', body: 'Add rooms, beds and photos, then submit for verification. Only verified properties appear to students.' },
  submitted: { label: 'Under review', tone: 'warn', body: 'THIKANO is reviewing your property. This usually takes one working day.' },
  changes_requested: { label: 'Changes requested', tone: 'warn', body: 'THIKANO asked for changes. Update the details and submit again.' },
  verified: { label: 'Verified', tone: 'ok', body: 'Your listed rooms are visible to students on THIKANO.' },
  rejected: { label: 'Not approved', tone: 'bad', body: 'Please contact THIKANO support.' },
  suspended: { label: 'Suspended', tone: 'bad', body: 'Listings are hidden. Please contact THIKANO support.' },
};

export default async function PropertiesPage() {
  const { session, properties, property } = await currentProperty();
  const canAdd = session.member.role === 'owner' || (session.member.role === 'manager' && session.member.propertyIds === null);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold">Properties</h1>
          <p className="mt-1 text-[14px] text-ink-500">{properties.length} propert{properties.length === 1 ? 'y' : 'ies'} in {session.orgName}</p>
        </div>
        {canAdd ? (
          <Link href="/properties/new" className={buttonClass('secondary')}>
            <Plus size={16} /> Add property
          </Link>
        ) : null}
      </div>
      {!property ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Building2 size={26} className="text-navy-500" />
          <p className="font-display text-[17px] font-bold">Add your first PG</p>
          <Link href="/properties/new" className={buttonClass('primary')}>Add property</Link>
        </Card>
      ) : (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-bold">{property.name}</h2>
                <StatusPill tone={STATUS[property.verification]!.tone}>{STATUS[property.verification]!.label}</StatusPill>
              </div>
              <p className="mt-1 max-w-xl text-[13.5px] text-ink-500">{STATUS[property.verification]!.body}</p>
            </div>
            {session.member.role === 'owner' && ['draft', 'changes_requested', 'rejected'].includes(property.verification) ? <SubmitVerificationButton orgId={session.orgId} propertyId={property.id} /> : null}
          </Card>
          {can(session.member, 'inventory.write', property.id) ? <PropertyForm orgId={session.orgId} uid={session.uid} property={property} /> : null}
        </>
      )}
    </div>
  );
}
