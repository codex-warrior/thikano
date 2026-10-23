import { LifeBuoy, MessageSquareWarning, Star } from 'lucide-react';
import { Card, EmptyState, SectionHeader } from '@thikano/web-ui';
import { getSupportQueues } from '@thikano/server/platform';
import { fmtDate, PageHeader } from '@/components/table';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Support, Reviews & Disputes' };

type Item = { id?: string; subject?: string; title?: string; text?: string; status?: string; createdAt?: number; rating?: number };

function Queue({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: Item[]; empty: string }) {
  return (
    <section>
      <SectionHeader title={title} subtitle={`${items.length} items`} />
      {items.length === 0 ? (
        <EmptyState icon={icon} title={empty} />
      ) : (
        <Card className="divide-y divide-line">
          {items.map((i, k) => (
            <div key={i.id ?? k} className="flex items-center justify-between gap-3 px-4 py-3 text-[13.5px]">
              <span className="font-medium">{i.subject ?? i.title ?? i.text ?? '—'}</span>
              <span className="text-ink-500">
                {i.rating ? `${i.rating}★ · ` : ''}
                {i.status ?? ''} · {fmtDate(i.createdAt ?? null, true)}
              </span>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}

export default async function SupportPage() {
  const s = await requirePlatform();
  const q = await getSupportQueues(s);
  return (
    <div className="space-y-8">
      <PageHeader title="Support, Reviews & Disputes" subtitle="Trust & safety queues. Residents and owners raise these from their apps." />
      <Queue title="Support tickets" icon={<LifeBuoy size={20} />} items={q.tickets as Item[]} empty="No open support tickets" />
      <Queue title="Disputes" icon={<MessageSquareWarning size={20} />} items={q.disputes as Item[]} empty="No disputes" />
      <Queue title="Reviews awaiting moderation" icon={<Star size={20} />} items={q.reviews as Item[]} empty="No reviews to moderate" />
    </div>
  );
}
