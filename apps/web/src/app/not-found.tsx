import Link from 'next/link';
import { buttonClass } from '@thikano/web-ui';
import { Footer, TopBar } from '@/components/chrome';

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-[24px] font-bold">This page isn&apos;t available</h1>
        <p className="mt-2 text-[14.5px] text-ink-500">The room or PG may no longer be listed on THIKANO.</p>
        <Link href="/" className={buttonClass('primary') + ' mt-6'}>
          Find available rooms
        </Link>
      </main>
      <Footer />
    </>
  );
}
