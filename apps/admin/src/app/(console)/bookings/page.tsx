import { formatINR, type BookingStage } from '@thikano/domain';
import { StatusPill, type Tone } from '@thikano/web-ui';
import { getBookingsAcrossPlatform } from '@thikano/server/platform';
import { fmtDate, PageHeader, Table } from '@/components/table';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Applications & Bookings' };

const TONE: Partial<Record<BookingStage, Tone>> = { moved_in: 'ok', booked: 'ok', approved: 'info', rejected: 'bad', cancelled: 'neutral', owner_review: 'warn', application: 'warn' };

export default async function BookingsPage() {
  const s = await requirePlatform();
  const rows = await getBookingsAcrossPlatform(s);
  const funnel = (['visit_requested', 'visit_scheduled', 'application', 'owner_review', 'approved', 'booked', 'moved_in'] as BookingStage[]).map((st) => [st, rows.filter((r) => r.stage === st).length] as const);
  return (
    <div className="space-y-6">
      <PageHeader title="Applications & Bookings" subtitle={funnel.map(([k, v]) => `${k.replace('_', ' ')} ${v}`).join(' · ')} />
      <Table
        rows={rows}
        rowKey={(r) => r.id}
        empty={{ title: 'No applications yet' }}
        columns={[
          { key: 'n', header: 'Student', cell: (r) => <span className="font-semibold">{r.studentName}</span> },
          { key: 'st', header: 'Stage', cell: (r) => <StatusPill tone={TONE[r.stage] ?? 'neutral'}>{r.stage.replace('_', ' ')}</StatusPill> },
          { key: 'rent', header: 'Rent', align: 'right', cell: (r) => formatINR(r.rent) },
          { key: 'mi', header: 'Move-in', cell: (r) => fmtDate(r.moveInDate) },
          { key: 'u', header: 'Updated', cell: (r) => fmtDate(r.updatedAt, true) },
        ]}
      />
    </div>
  );
}
