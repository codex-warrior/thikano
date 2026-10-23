import { Bell } from 'lucide-react';
import Link from 'next/link';
import { can } from '@thikano/domain';
import { getDashboard } from '@thikano/server/owner';
import { Sidebar } from '@/components/sidebar';
import { PropertySwitcher, UserMenu } from '@/components/header-controls';
import { NAV } from '@/lib/nav';
import { currentProperty } from '@/lib/session';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { session, properties, property } = await currentProperty();
  const nav = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => (i.ownerOnly ? session.member.role === 'owner' : !i.permission || can(session.member, i.permission, property?.id))),
  })).filter((g) => g.items.length);
  const d = property ? await getDashboard(session, property) : null;

  return (
    <div className="min-h-dvh">
      <Sidebar nav={nav} badges={{ '/leads': d?.newLeads.length ?? 0, '/maintenance': d?.openIssues.filter((i) => i.issue.status === 'open').length ?? 0 }} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/90 px-4 pl-16 backdrop-blur sm:px-6 lg:pl-8">
          <PropertySwitcher
            current={property ? { id: property.id, name: property.name, locality: `${property.address.locality}, ${property.address.city}` } : null}
            properties={properties.map((p) => ({ id: p.id, name: p.name, locality: `${p.address.locality}, ${p.address.city}` }))}
          />
          <div className="ml-auto" />
          <Link href="/leads" className="relative grid size-9 place-items-center rounded-lg text-ink-500 hover:bg-surface" aria-label="New enquiries">
            <Bell size={18} />
            {d?.newLeads.length ? <span className="absolute right-2 top-2 size-2 rounded-full bg-bad-600" /> : null}
          </Link>
          <UserMenu name={session.name} role={session.member.role} />
        </header>
        <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
