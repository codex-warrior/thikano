import { Megaphone } from 'lucide-react';
import { Card, EmptyState, StatusPill } from '@thikano/web-ui';
import { getNotices, getStructure } from '@thikano/server/owner';
import { NewNoticeButton } from '@/components/ops-actions';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Notices' };

const fmt = (t: number) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(t);
const time = (t: number) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(t);

export default async function NoticesPage() {
  const { session, property } = await requireProperty();
  const [notices, { buildings }] = await Promise.all([getNotices(session, property.id), getStructure(session, property.id)]);
  const bName = new Map(buildings.map((b) => [b.id, b.name]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold">Notices</h1>
          <p className="mt-1 text-[14px] text-ink-500">Reach every resident instantly — no more WhatsApp forwards.</p>
        </div>
        <NewNoticeButton orgId={session.orgId} propertyId={property.id} uid={session.uid} buildings={buildings.map((b) => ({ id: b.id, name: b.name }))} />
      </div>
      {notices.length === 0 ? (
        <EmptyState icon={<Megaphone size={20} />} title="No notices yet" body="Publish water cuts, events and rule changes. Residents are notified on their phones." />
      ) : (
        <Card className="divide-y divide-line">
          {notices.map((n) => (
            <div key={n.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{n.title}</p>
                <StatusPill tone={n.publishedAt ? 'ok' : 'neutral'}>{n.publishedAt ? 'Published' : 'Draft'}</StatusPill>
                <span className="text-[12px] text-ink-400">{n.buildingIds?.length ? n.buildingIds.map((b) => bName.get(b) ?? b).join(', ') : 'Everyone'}</span>
              </div>
              {n.body ? <p className="mt-1 text-[13.5px] text-ink-700">{n.body}</p> : null}
              <p className="mt-1 text-[12px] text-ink-400">
                {n.startsAt ? `${fmt(n.startsAt)}${n.endsAt ? ` – ${time(n.endsAt)}` : ''} · ` : ''}posted {fmt(n.createdAt)}
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
