import { CalendarClock, Inbox, Phone } from 'lucide-react';
import { can, LEAD_STATUS_LABEL, type BookingStage, type LeadSource, type LeadStatus } from '@thikano/domain';
import { Avatar, Card, EmptyState, StatusPill, type Tone } from '@thikano/web-ui';
import { getLeads, getRooms } from '@thikano/server/owner';
import { LeadActions } from '@/components/lead-actions';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Listings & Leads' };

const STATUS_TONE: Record<LeadStatus, Tone> = { new: 'brand', contacted: 'info', visit_scheduled: 'info', interested: 'navy', applied: 'warn', approved: 'ok', rejected: 'bad', converted: 'ok', lost: 'neutral' };
const SOURCE_LABEL: Record<LeadSource, string> = { room_share_link: 'Room link', property_share_link: 'Property link', discover: 'THIKANO search', qr: 'QR code', walk_in: 'Walk-in', other: 'Other' };
const STAGE_LABEL: Partial<Record<BookingStage, string>> = { visit_requested: 'Visit requested', visit_scheduled: 'Visit scheduled', application: 'Application', owner_review: 'Reviewing', approved: 'Approved — book a bed', booked: 'Bed booked — ready to move in', moved_in: 'Moved in', rejected: 'Rejected', cancelled: 'Cancelled' };

function ago(t: number) {
  const m = Math.max(1, Math.round((Date.now() - t) / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { session, property } = await requireProperty();
  const [rows, rooms] = await Promise.all([getLeads(session, property.id), getRooms(session, property)]);
  const freeBeds = new Map(rooms.map((r) => [r.room.id, r.beds.filter((b) => b.status === 'available').map((b) => ({ id: b.id, label: b.label }))]));
  const counts = rows.reduce<Record<string, number>>((a, r) => ((a[r.lead.status] = (a[r.lead.status] ?? 0) + 1), a), {});
  const shown = status ? rows.filter((r) => r.lead.status === status) : rows.filter((r) => !['lost', 'rejected', 'converted'].includes(r.lead.status));
  const canWrite = can(session.member, 'leads.write', property.id);
  const canMoveIn = can(session.member, 'residents.write', property.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold">Listings & Leads</h1>
        <p className="mt-1 text-[14px] text-ink-500">Students who showed interest in {property.name}.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href="/leads" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] ${!status ? 'border-navy-700 bg-navy-700 text-white' : 'border-line bg-surface'}`}>
          Open <b className="tabular">{rows.filter((r) => !['lost', 'rejected', 'converted'].includes(r.lead.status)).length}</b>
        </a>
        {(['new', 'contacted', 'visit_scheduled', 'applied', 'approved', 'converted', 'lost'] as LeadStatus[]).map((s) => (
          <a key={s} href={`/leads?status=${s}`} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] ${status === s ? 'border-navy-700 bg-navy-700 text-white' : 'border-line bg-surface'}`}>
            {LEAD_STATUS_LABEL[s]} <b className="tabular">{counts[s] ?? 0}</b>
          </a>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={<Inbox size={20} />} title="No student enquiries yet" body="Once students show interest, they'll appear here. Share your rooms to get started." />
      ) : (
        <Card className="divide-y divide-line">
          {shown.map(({ lead, booking, room }) => (
            <div key={lead.id} className="flex flex-wrap items-center gap-4 p-4">
              <Avatar name={lead.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{lead.name}</p>
                  <StatusPill tone={STATUS_TONE[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</StatusPill>
                  {booking && STAGE_LABEL[booking.stage] ? <span className="text-[12px] font-medium text-ink-500">· {STAGE_LABEL[booking.stage]}</span> : null}
                </div>
                <p className="mt-0.5 truncate text-[12.5px] text-ink-500">
                  {room ? `Room ${room.number}` : 'Property'} · via {SOURCE_LABEL[lead.source]} · {ago(lead.createdAt)}
                  {lead.message ? ` · “${lead.message}”` : ''}
                </p>
                {booking?.visitAt && booking.stage === 'visit_scheduled' ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-info-600">
                    <CalendarClock size={13} /> Visit {new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(booking.visitAt)}
                  </p>
                ) : null}
              </div>
              <a href={`tel:${lead.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-semibold text-navy-700 hover:bg-navy-50">
                <Phone size={14} /> Call
              </a>
              <LeadActions orgId={session.orgId} lead={lead} booking={booking} freeBeds={lead.roomId ? freeBeds.get(lead.roomId) ?? [] : []} canWrite={canWrite} canMoveIn={canMoveIn} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
