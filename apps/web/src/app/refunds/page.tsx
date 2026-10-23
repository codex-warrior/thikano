import { LegalPage } from '@/components/legal-page';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Refund & Cancellation Policy' };

export default function Refunds() {
  return (
    <LegalPage title="Refund & Cancellation Policy">
      <h2>Rent payments</h2>
      <ul>
        <li>Rent paid through THIKANO is paid to your PG for the billed month and is not refundable through THIKANO once the period has started, except where your PG agrees.</li>
        <li>If you were charged twice or a payment failed but money was debited, contact {LEGAL.supportEmail} with your receipt number. Verified duplicate or failed payments are refunded to the original payment method within 7 working days of confirmation.</li>
      </ul>
      <h2>Security deposits</h2>
      <p>Deposits are held and refunded by the PG owner according to your stay agreement and house rules after move-out. THIKANO can help resolve disputes through support.</p>
      <h2>Bookings</h2>
      <p>If a booking is cancelled before move-in, any advance paid to the owner is refundable as per the owner’s stated policy on the property page. Bookings cancelled by the owner are refunded in full.</p>
      <h2>Service orders</h2>
      <ul>
        <li>You can cancel an order until the provider accepts it, for a full refund.</li>
        <li>If an order is not delivered or is materially wrong, report it within 24 hours from the app; eligible amounts are refunded to the original payment method within 7 working days.</li>
      </ul>
      <h2>Contact</h2>
      <p>
        {LEGAL.supportEmail} · {LEGAL.supportPhone}
      </p>
    </LegalPage>
  );
}
