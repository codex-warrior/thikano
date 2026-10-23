import Link from 'next/link';
import { ArrowRight, BedDouble, CircleCheck, DoorOpen, IndianRupee, Inbox, LogOut, ShieldAlert, Sparkles, Wrench } from 'lucide-react';
import { can, formatINR, type ServiceCategory } from '@thikano/domain';
import { buttonClass, Card, SectionHeader, StatTile } from '@thikano/web-ui';
import { getDashboard } from '@thikano/server/owner';
import { RoomTile } from '@/components/room-tile';
import { ShareButton } from '@/components/room-actions';
import { requireProperty } from '@/lib/session';

export const metadata = { title: 'Dashboard' };

const CATEGORY_LABEL: Partial<Record<ServiceCategory, string>> = { food: 'Food', laundry: 'Laundry', cleaning: 'Cleaning', groceries: 'Groceries', pharmacy: 'Pharmacy', other: 'Other' };
const VERIFY_COPY: Record<string, string> = {
  draft: 'Finish your property details and submit for verification to start listing rooms.',
  submitted: 'THIKANO is reviewing your property. Listed rooms go live as soon as it is verified.',
  changes_requested: 'THIKANO asked for a few changes before verifying your property.',
  rejected: 'This property was not approved. Contact THIKANO support for help.',
  suspended: 'This property is suspended. Listings are hidden from students.',
};

export default async function DashboardPage() {
  const { session, property } = await requireProperty();
  const d = await getDashboard(session, property);
  const m = session.member;
  const now = Date.now();
  const hour = (new Date(now).getUTCHours() + 5.5) % 24;
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(now);
  const canPublish = can(m, 'listings.publish', property.id);

  const attention: { icon: React.ReactNode; tone: string; title: string; detail: string; action: string; href: string }[] = [];
  if (property.verification !== 'verified') {
    attention.push({ icon: <ShieldAlert size={16} />, tone: 'bg-warn-100 text-warn-600', title: 'Property not verified yet', detail: VERIFY_COPY[property.verification] ?? '', action: 'View property', href: '/properties' });
  }
  for (const o of d.overdue.slice(0, 2)) {
    attention.push({ icon: <IndianRupee size={16} />, tone: 'bg-bad-100 text-bad-600', title: `${formatINR(o.due)} overdue`, detail: `${o.resident?.name ?? 'Resident'}`, action: 'Collect rent', href: '/rent' });
  }
  for (const x of d.openIssues.filter((i) => i.issue.status === 'open').slice(0, 2)) {
    attention.push({ icon: <Wrench size={16} />, tone: 'bg-warn-100 text-warn-600', title: x.issue.description, detail: `Room ${x.room?.number ?? '—'}`, action: 'View issue', href: '/maintenance' });
  }
  if (d.leaving.length) {
    attention.push({ icon: <LogOut size={16} />, tone: 'bg-info-100 text-info-600', title: `${d.leaving.length} resident${d.leaving.length === 1 ? '' : 's'} leaving soon`, detail: 'Plan turnover and list beds early', action: 'Contact residents', href: '/residents' });
  }
  if (d.vacantBeds) {
    attention.push({ icon: <BedDouble size={16} />, tone: 'bg-navy-100 text-navy-700', title: `${d.vacantBeds} vacant bed${d.vacantBeds === 1 ? '' : 's'}`, detail: `${formatINR(d.vacantRevenue)} / month not being earned`, action: 'List rooms', href: '/vacancies' });
  }
  if (d.newLeads.length) {
    attention.push({ icon: <Inbox size={16} />, tone: 'bg-marigold-100 text-marigold-600', title: `${d.newLeads.length} student${d.newLeads.length === 1 ? '' : 's'} interested`, detail: 'New enquiries waiting for a reply', action: 'View leads', href: '/leads' });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-ink-500">{today}</p>
          <h1 className="mt-1 text-[26px] font-bold">
            {greeting}, {session.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-[14px] text-ink-500">Here&apos;s what&apos;s happening at {property.name} today.</p>
        </div>
        <div className="flex gap-2">
          <ShareButton kind="pg" slug={property.slug} title={property.name} summary={`${d.vacantBeds} beds currently available`} target={{ orgId: session.orgId, propertyId: property.id }} disabledReason={property.verification === 'verified' ? undefined : 'Sharing opens once THIKANO verifies this property'} />
          <Link href="/vacancies" className={buttonClass('primary', 'sm')}>
            <DoorOpen size={14} /> Fill vacancies
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatTile label="Occupancy" value={<>{d.occupied}<span className="text-[16px] text-ink-400"> / {d.totalBeds}</span></>} hint={d.totalBeds ? `${Math.round((d.occupied / d.totalBeds) * 100)}% full` : 'Add beds to start'} tone="ok" />
        {d.rent ? (
          <>
            <StatTile label="Rent collected" value={formatINR(d.rent.collected, { compact: true })} hint="This month" />
            <StatTile label="Outstanding" value={formatINR(d.rent.outstanding, { compact: true })} hint={`${d.overdue.length} overdue`} tone={d.overdue.length ? 'bad' : undefined} />
          </>
        ) : null}
        <StatTile label="Open issues" value={d.openIssues.length} hint={`${d.openIssues.filter((x) => x.issue.status === 'open').length} unassigned`} tone={d.openIssues.length ? 'warn' : undefined} />
        <StatTile label="Vacant beds" value={d.vacantBeds} hint={`${formatINR(d.vacantRevenue, { compact: true })}/mo potential`} />
        {d.earnings ? <StatTile label="Service earnings" value={formatINR(d.earnings.total)} hint="This month" tone="ok" /> : null}
        <StatTile label="New leads" value={d.newLeads.length} hint="Waiting for reply" tone={d.newLeads.length ? 'warn' : undefined} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section>
          <SectionHeader title="Needs attention" subtitle="Every item has one next step." />
          <Card className="divide-y divide-line">
            {attention.map((a, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${a.tone}`}>{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink-900">{a.title}</p>
                  <p className="truncate text-[12.5px] text-ink-500">{a.detail}</p>
                </div>
                <Link href={a.href} className={buttonClass('secondary', 'sm')}>
                  {a.action}
                </Link>
              </div>
            ))}
            {attention.length === 0 ? (
              <div className="flex items-center gap-3 p-6 text-[14px] text-ink-500">
                <CircleCheck size={16} className="text-ok-600" /> Nothing needs your attention. Everything looks good.
              </div>
            ) : null}
          </Card>
        </section>

        {d.earnings ? (
          <section>
            <SectionHeader title="THIKANO earnings" subtitle="Your partner share from resident services" action={<Link href="/earnings" className="text-[12.5px] font-semibold text-navy-700">Details</Link>} />
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-marigold-100 text-marigold-600">
                  <Sparkles size={18} />
                </span>
                <p className="tabular font-display text-[28px] font-bold">{formatINR(d.earnings.total)}</p>
              </div>
              {d.earnings.total === 0 ? (
                <p className="mt-4 text-[13px] text-ink-500">Earnings appear when residents order food, laundry and cleaning through THIKANO.</p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {Object.entries(d.earnings.byCategory)
                    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                    .map(([cat, amt]) => (
                      <li key={cat}>
                        <div className="flex justify-between text-[13.5px]">
                          <span className="text-ink-700">{CATEGORY_LABEL[cat as ServiceCategory] ?? cat}</span>
                          <span className="tabular font-semibold">{formatINR(amt ?? 0)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-navy-50">
                          <div className="h-full rounded-full bg-navy-600" style={{ width: `${((amt ?? 0) / Math.max(1, d.earnings!.total)) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          </section>
        ) : null}
      </div>

      <section>
        <SectionHeader
          title="Vacant rooms"
          subtitle={`${d.vacantBeds} beds across ${d.vacantRooms.length} rooms`}
          action={
            <Link href="/vacancies" className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy-700">
              All vacancies <ArrowRight size={14} />
            </Link>
          }
        />
        {d.vacantRooms.length === 0 ? (
          <Card className="p-6 text-[14px] text-ink-500">No vacant rooms. Your property is fully occupied.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {d.vacantRooms
              .sort((a, b) => b.room.inventory.availableBeds - a.room.inventory.availableBeds)
              .slice(0, 4)
              .map(({ room, listingStatus }) => (
                <RoomTile key={room.id} room={room} property={property} listingStatus={listingStatus} canPublish={canPublish} />
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
