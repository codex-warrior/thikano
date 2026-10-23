import Link from 'next/link';
import { Logo } from '@thikano/web-ui';

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" aria-label="THIKANO home">
          <Logo size="sm" />
        </Link>
        <a href="#get-app" className="text-[13px] font-semibold text-navy-700">
          Get the app
        </a>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer id="get-app" className="mt-16 bg-navy-900 text-navy-200">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Logo tone="light" />
        <p className="mt-3 max-w-md text-[14px]">The operating system for PGs & hostels. Find your PG. See the actual room. Move in. Live better.</p>
        <p className="mt-8 text-[12px] text-navy-300">© {2026} THIKANO. Room details are published by property owners and verified by THIKANO.</p>
      </div>
    </footer>
  );
}
