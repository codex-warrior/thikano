import Link from 'next/link';
import { Users } from 'lucide-react';
import { can, formatINR } from '@thikano/domain';
import { Avatar, buttonClass, Card, EmptyState, StatusPill } from '@thikano/web-ui';
import { getResidents, getRooms } from '@thikano/server/owner';
import { ResidentActions } from '@/components/resident-actions';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Residents' };

export default async function ResidentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { session, property } = await requireProperty();
  const [rows, rooms] = await Promise.all([getResidents(session, property.id), getRooms(session, property)]);
  const freeBeds = rooms.flatMap((r) => r.beds.filter((b) => b.status === 'available').map((b) => ({ id: b.id, label: `Room ${r.room.number} · Bed ${b.label}` })));
  const bedLabel = new Map(rooms.flatMap((r) => r.beds.map((b) => [b.id, b.label])));
  const needle = q?.trim().toLowerCase();
  const shown = needle ? rows.filter((r) => r.resident.name.toLowerCase().includes(needle) || r.room?.number.includes(needle)) : rows;
  const canWrite = can(session.member, 'residents.write', property.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold">Residents</h1>
          <p className="mt-1 text-[14px] text-ink-500">
            {rows.length} living at {property.name} · {rows.filter((r) => r.resident.status === 'notice').length} leaving soon
          </p>
        </div>
        <div className="flex gap-2">
          <form className="hidden sm:block">
            <input name="q" defaultValue={q} placeholder="Search name or room" className="h-10 w-56 rounded-lg border border-line-strong bg-surface px-3 text-[14px] outline-none focus:border-navy-500" />
          </form>
          {canWrite ? (
            <Link href="/rooms" className={buttonClass('primary')}>
              Add resident
            </Link>
          ) : null}
        </div>
      </div>
      {canWrite ? <p className="text-[12.5px] text-ink-400">To add a resident, open a room and use “Assign” on an available bed — or move in a student from Listings & Leads.</p> : null}

      {shown.length === 0 ? (
        <EmptyState icon={<Users size={20} />} title={q ? 'No residents match' : 'No residents yet'} body={q ? 'Try another name or room number.' : 'Assign residents to beds from Rooms & Beds.'} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="border-b border-line text-[12px] uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Resident</th>
                <th className="px-4 py-3 font-semibold">Room</th>
                <th className="px-4 py-3 font-semibold">Since</th>
                <th className="px-4 py-3 text-right font-semibold">Rent</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map(({ resident: r, room }) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} />
                      <div>
                        <div className="font-semibold">{r.name}</div>
                        <a href={`tel:${r.phone}`} className="text-[12px] text-ink-500 hover:text-navy-700">
                          {r.phone}
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {room ? (
                      <Link href={`/rooms/${room.id}`} className="font-medium text-navy-700">
                        Room {room.number}
                      </Link>
                    ) : (
                      '—'
                    )}{' '}
                    · Bed {bedLabel.get(r.bedId) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-500">{new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(r.moveInDate)}</td>
                  <td className="tabular px-4 py-3 text-right">{formatINR(r.rent)}</td>
                  <td className="px-4 py-3">
                    {r.status === 'notice' ? (
                      <StatusPill tone="warn">Leaving {r.moveOutDate ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(r.moveOutDate) : 'soon'}</StatusPill>
                    ) : (
                      <StatusPill tone={r.uid ? 'ok' : 'neutral'}>{r.uid ? 'Active' : 'App not linked'}</StatusPill>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{canWrite ? <ResidentActions orgId={session.orgId} residentId={r.id} name={r.name} status={r.status} freeBeds={freeBeds} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
