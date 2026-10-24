'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { cx, Logo } from '@thikano/web-ui';
import { firebase } from '@/lib/firebase';
import type { NavItem } from '@/lib/nav';

export function Sidebar({ nav, badges }: { nav: { group?: string; items: NavItem[] }[]; badges: Record<string, number> }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  async function logout() {
    await fetch('/api/session', { method: 'DELETE' });
    await signOut(firebase().auth).catch(() => undefined);
    router.replace('/login');
  }
  return (
    <>
      <button className="fixed left-3 top-3 z-40 grid size-10 place-items-center rounded-lg bg-navy-950 text-white lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu size={18} />
      </button>
      {open ? <div className="fixed inset-0 z-40 bg-navy-950/40 lg:hidden" onClick={() => setOpen(false)} /> : null}
      <aside className={cx('fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-navy-950 transition-transform duration-200 lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center justify-between px-5">
          <Logo tone="light" size="sm" suffix="ADMIN" />
          <button className="text-navy-200 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-6">
          {nav.map((g, i) => (
            <div key={i}>
              {g.group ? <p className="mb-1 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-navy-300/60">{g.group}</p> : null}
              {g.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cx('flex items-center justify-between rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors', active(item.href) ? 'bg-white/10 text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white')}
                >
                  {item.label}
                  {badges[item.href] ? <span className="tabular rounded-full bg-accent-500 px-1.5 text-[11px] font-bold text-navy-950">{badges[item.href]}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <button onClick={logout} className="mx-3 mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-navy-200 hover:bg-white/5 hover:text-white">
          <LogOut size={15} /> Sign out
        </button>
      </aside>
    </>
  );
}
