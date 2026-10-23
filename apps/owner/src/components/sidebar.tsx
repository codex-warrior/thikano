'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cx, Logo } from '@thikano/web-ui';
import type { NavItem } from '@/lib/nav';
import { NavIcon } from './icon';

export function Sidebar({ nav, badges }: { nav: { group?: string; items: NavItem[] }[]; badges: Record<string, number> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      <button className="fixed left-3 top-3 z-40 grid size-10 place-items-center rounded-lg bg-navy-900 text-white lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu size={18} />
      </button>
      {open ? <div className="fixed inset-0 z-40 bg-navy-950/40 lg:hidden" onClick={() => setOpen(false)} /> : null}
      <aside className={cx('fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy-900 transition-transform duration-200 lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center justify-between px-6">
          <Logo tone="light" size="sm" suffix="OWNER" />
          <button className="text-navy-200 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-6">
          {nav.map((group, gi) => (
            <div key={gi}>
              {group.group ? <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-navy-300/70">{group.group}</p> : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cx(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors duration-150',
                        active(item.href) ? 'bg-white/10 text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      <NavIcon name={item.icon} />
                      <span className="flex-1">{item.label}</span>
                      {badges[item.href] ? <span className="tabular rounded-full bg-marigold-500 px-1.5 text-[11px] font-bold text-navy-950">{badges[item.href]}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
