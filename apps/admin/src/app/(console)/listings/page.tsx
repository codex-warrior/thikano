import { formatINR, SHARING_LABEL } from '@thikano/domain';
import { StatusPill } from '@thikano/web-ui';
import { getListedRooms } from '@thikano/server/platform';
import { SuspendButton } from '@/components/admin-actions';
import { PageHeader, Table } from '@/components/table';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Listings' };

const PUBLIC_WEB = process.env.NEXT_PUBLIC_PUBLIC_WEB_URL ?? 'https://habistat.com';

export default async function ListingsPage() {
  const s = await requirePlatform();
  const rows = await getListedRooms(s);
  return (
    <div className="space-y-6">
      <PageHeader title="Listings" subtitle={`${rows.length} rooms listed by owners · moderation suspends a single listing without touching the owner's settings`} />
      <Table
        rows={rows}
        rowKey={(r) => r.room.id}
        empty={{ title: 'No listings yet' }}
        columns={[
          { key: 'p', header: 'Room', cell: (r) => (<><div className="font-semibold">{r.propertyName} · Room {r.room.number}</div><div className="text-[12px] text-ink-500">{SHARING_LABEL[r.room.sharing]}</div></>) },
          { key: 'rent', header: 'Rent', align: 'right', cell: (r) => formatINR(r.room.rent) },
          { key: 'avail', header: 'Available', align: 'right', cell: (r) => `${r.room.inventory?.availableBeds ?? 0} / ${r.room.inventory?.totalBeds ?? 0}` },
          { key: 'views', header: 'Views', align: 'right', cell: (r) => r.room.stats?.views ?? 0 },
          { key: 'enq', header: 'Enquiries', align: 'right', cell: (r) => r.room.stats?.enquiries ?? 0 },
          { key: 'status', header: 'Moderation', cell: (r) => (r.suspended ? <StatusPill tone="bad">Suspended</StatusPill> : <StatusPill tone="ok">OK</StatusPill>) },
          {
            key: 'link',
            header: '',
            align: 'right',
            cell: (r) => (
              <div className="flex items-center justify-end gap-2">
                {r.room.publicSlug && !r.suspended ? (
                  <a className="text-[12.5px] font-semibold text-navy-700" href={`${PUBLIC_WEB}/room/${r.room.publicSlug}`} target="_blank" rel="noreferrer">
                    View
                  </a>
                ) : null}
                {s.role === 'platform_admin' ? <SuspendButton kind="room" orgId={r.room.orgId} propertyId={r.room.propertyId} roomId={r.room.id} suspended={r.suspended} label={`Room ${r.room.number}`} /> : null}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
