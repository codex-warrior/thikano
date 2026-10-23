import { Check, ShieldCheck, X } from 'lucide-react';
import { formatINR } from '@thikano/domain';
import { Card, EmptyState, StatusPill } from '@thikano/web-ui';
import { getVerificationQueue } from '@thikano/server/platform';
import { ReviewActions } from '@/components/admin-actions';
import { fmtDate } from '@/components/table';
import { requirePlatform } from '@/lib/session';

export const metadata = { title: 'Property Verification' };

export default async function VerificationPage() {
  const s = await requirePlatform();
  const queue = await getVerificationQueue(s);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold">Property Verification</h1>
        <p className="mt-1 text-[14px] text-ink-500">Only verified properties become publicly searchable. Oldest submissions first.</p>
      </div>
      {queue.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={20} />} title="Nothing to review" body="New property submissions will appear here." />
      ) : (
        queue.map((q) => (
          <Card key={q.property.id} className="overflow-hidden">
            <div className="grid md:grid-cols-[280px_1fr]">
              {q.property.photos?.[0] ? <img src={q.property.photos[0].url} alt="" className="h-48 w-full object-cover md:h-full" /> : <div className="min-h-32 bg-navy-50" />}
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[20px] font-bold uppercase tracking-wide">{q.property.name}</h2>
                    <p className="text-[13.5px] text-ink-500">
                      {q.property.address.line1}, {q.property.address.locality}, {q.property.address.city} {q.property.address.pincode}
                    </p>
                    <p className="mt-1 text-[13.5px]">
                      Owner <b className="font-semibold">{q.ownerName}</b> · submitted {fmtDate(q.submittedAt, true)}
                    </p>
                  </div>
                  <StatusPill tone="warn">Pending review</StatusPill>
                </div>
                <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {q.checklist.map((c) => (
                    <div key={c.label} className="flex items-start gap-2 text-[13.5px]">
                      {c.ok ? <Check size={16} className="mt-0.5 text-ok-600" /> : <X size={16} className="mt-0.5 text-bad-600" />}
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[13px] text-ink-500">
                  {q.rooms} rooms · {q.beds} beds · starting {q.startingRent ? formatINR(q.startingRent) : '—'}/month
                </p>
                {q.property.description ? <p className="mt-2 text-[13px] text-ink-700">{q.property.description}</p> : null}
                <div className="mt-5">{s.role === 'platform_admin' ? <ReviewActions orgId={q.orgId} propertyId={q.property.id} name={q.property.name} /> : <p className="text-[12.5px] text-ink-400">Only platform admins can approve properties.</p>}</div>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
