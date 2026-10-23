'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LogOut, Plus } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { Avatar } from '@thikano/web-ui';
import { firebase } from '@/lib/firebase';
import { selectProperty } from '@/app/(console)/actions';

export function PropertySwitcher({ current, properties }: { current: { id: string; name: string; locality: string } | null; properties: { id: string; name: string; locality: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-left shadow-[var(--shadow-card)]" aria-haspopup="listbox" aria-expanded={open}>
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-navy-700 text-[11px] font-bold text-white">{(current?.name ?? 'TH').slice(0, 2).toUpperCase()}</span>
        <span className="min-w-0">
          <span className="block max-w-[180px] truncate text-[13.5px] font-semibold leading-tight">{current?.name ?? 'Add your first property'}</span>
          <span className="block truncate text-[11.5px] leading-tight text-ink-500">{current?.locality ?? 'Get started'}</span>
        </span>
        <ChevronDown size={15} className="shrink-0 text-ink-400" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-raised)]" role="listbox">
          {properties.map((p) => (
            <button
              key={p.id}
              onClick={async () => {
                setOpen(false);
                await selectProperty(p.id);
                router.refresh();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-navy-50"
            >
              <span className="flex-1">
                <span className="block text-[13.5px] font-semibold">{p.name}</span>
                <span className="block text-[12px] text-ink-500">{p.locality}</span>
              </span>
              {p.id === current?.id ? <Check size={15} className="text-navy-700" /> : null}
            </button>
          ))}
          <button onClick={() => router.push('/properties/new')} className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-line px-3 py-2.5 text-[13px] font-semibold text-navy-700 hover:bg-navy-50">
            <Plus size={15} /> Add property
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function UserMenu({ name, role }: { name: string; role: string }) {
  const router = useRouter();
  async function logout() {
    await fetch('/api/session', { method: 'DELETE' });
    await signOut(firebase().auth).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2">
      <Avatar name={name} />
      <div className="hidden text-[12.5px] leading-tight sm:block">
        <div className="font-semibold">{name}</div>
        <div className="capitalize text-ink-500">{role}</div>
      </div>
      <button onClick={logout} className="ml-1 grid size-9 place-items-center rounded-lg text-ink-500 hover:bg-surface" aria-label="Sign out" title="Sign out">
        <LogOut size={17} />
      </button>
    </div>
  );
}
