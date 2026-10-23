import Link from 'next/link';
import type { ReactNode } from 'react';
import { Footer, TopBar } from './chrome';
import { isDraft, LEGAL } from '@/lib/legal';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 py-10">
        {isDraft ? (
          <p className="mb-6 rounded-lg bg-warn-100 px-4 py-3 text-[13.5px] font-medium text-warn-600" role="note">
            Draft — business details are placeholders and this policy has not yet been reviewed by a lawyer.
          </p>
        ) : null}
        <h1 className="text-[30px] font-extrabold">{title}</h1>
        <p className="mt-1 text-[13px] text-ink-500">Effective {LEGAL.effectiveDate}</p>
        <div className="legal mt-8 space-y-5 text-[15px] leading-relaxed text-ink-700 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:text-ink-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
        <p className="mt-12 text-[13px] text-ink-500">
          See also: <Link className="text-navy-700" href="/privacy">Privacy</Link> · <Link className="text-navy-700" href="/terms">Terms</Link> · <Link className="text-navy-700" href="/refunds">Refunds</Link> · <Link className="text-navy-700" href="/contact">Contact</Link> · <Link className="text-navy-700" href="/delete-account">Delete account</Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
