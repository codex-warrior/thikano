import { CheckCircle2, Clock } from 'lucide-react';
import { Footer, TopBar } from '@/components/chrome';

export const metadata = { title: 'Payment', robots: { index: false } };

/**
 * Razorpay redirects here after checkout (callback_url). We never trust these query params:
 * the signed webhook is what marks rent as paid. This page only tells the resident what to expect.
 */
export default async function PaymentReturn({ searchParams }: { searchParams: Promise<{ razorpay_payment_link_status?: string }> }) {
  const { razorpay_payment_link_status: status } = await searchParams;
  const paid = status === 'paid';
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <div className={`mx-auto grid size-14 place-items-center rounded-full ${paid ? 'bg-ok-100 text-ok-600' : 'bg-warn-100 text-warn-600'}`}>{paid ? <CheckCircle2 size={26} /> : <Clock size={26} />}</div>
        <h1 className="mt-5 text-[24px] font-bold">{paid ? 'Payment received' : 'Payment not completed'}</h1>
        <p className="mt-2 text-[15px] text-ink-500">{paid ? 'Your receipt will appear in the Habistat app within a minute. You can close this page.' : 'No money was taken. You can go back to the Habistat app and try again.'}</p>
      </main>
      <Footer />
    </>
  );
}
