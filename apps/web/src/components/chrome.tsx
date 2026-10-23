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
        <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px]" aria-label="Legal">
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <Link href="/refunds" className="hover:text-white">Refunds</Link>
          <Link href="/contact" className="hover:text-white">Contact</Link>
          <Link href="/delete-account" className="hover:text-white">Delete account</Link>
        </nav>
        <p className="mt-6 text-[12px] text-navy-300">© {new Date().getFullYear()} THIKANO. Room details are published by property owners and verified by THIKANO.</p>
      </div>
    </footer>
  );
}
