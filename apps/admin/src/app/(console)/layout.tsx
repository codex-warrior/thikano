import { Avatar, StatusPill } from '@thikano/web-ui';
import { getPlatformMetrics } from '@thikano/server/platform';
import { Sidebar } from '@/components/sidebar';
import { NAV } from '@/lib/nav';
import { requirePlatform } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePlatform();
  const m = await getPlatformMetrics(s);
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || s.role === 'platform_admin') })).filter((g) => g.items.length);
  return (
    <div className="min-h-dvh">
      <Sidebar nav={nav} badges={{ '/verification': m.pending }} />
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          {process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST ? <StatusPill tone="warn">Local emulator</StatusPill> : null}
          <Avatar name={s.name} />
          <div className="hidden text-[12.5px] leading-tight sm:block">
            <div className="font-semibold">{s.name}</div>
            <div className="text-ink-500">{s.role === 'platform_admin' ? 'Platform Admin' : 'Platform Support'}</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
