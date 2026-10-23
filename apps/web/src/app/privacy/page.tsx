import { LegalPage } from '@/components/legal-page';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Privacy Policy' };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        THIKANO is operated by {LEGAL.entityName} (“THIKANO”, “we”). This policy explains what personal data we process when you use the THIKANO app, website and owner tools, why we
        process it, and your rights under the Digital Personal Data Protection Act, 2023 and other applicable Indian law.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Account:</b> mobile number (for sign-in), name, and email for property owners and staff.</li>
        <li><b>Enquiries:</b> name, mobile number, expected move-in date and message when you contact a PG.</li>
        <li><b>Stay records:</b> property, room, bed, rent, deposit, move-in and move-out dates, invoices and payment receipts, maintenance requests and parcels, entered by you or your PG.</li>
        <li><b>Service orders:</b> items ordered, amounts and delivery status.</li>
        <li><b>Device:</b> push-notification token and app install identifier, so we can send you notifications.</li>
        <li><b>Search analytics:</b> area or college searched, approximate location (about 1 km), budget and filters — not linked to your name or number.</li>
        <li><b>Payments:</b> processed by our payment partner. We receive the payment status and reference, never your card or UPI credentials.</li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To let you find rooms and send enquiries, and to let the PG you contact reply.</li>
        <li>To run your stay: rent, receipts, notices, maintenance and services.</li>
        <li>To keep THIKANO secure (fraud prevention, rate limiting, audit logs).</li>
        <li>To understand demand in aggregate and improve the product.</li>
      </ul>
      <h2>Who sees your data</h2>
      <ul>
        <li><b>The PG you contact or live at</b> sees your enquiry or stay details. Other PGs do not.</li>
        <li><b>Service providers</b> see what is needed to deliver your order (name, room, phone).</li>
        <li><b>Processors</b> acting on our instructions: Google Cloud / Firebase (hosting, India and Singapore regions), our SMS provider (sign-in codes) and our payment gateway.</li>
        <li>We do not sell personal data. Public room pages never show residents’ names, numbers or exact addresses.</li>
      </ul>
      <h2>How long we keep it</h2>
      <p>Account data is kept while your account is active. Rent and payment records may be kept by the PG for the period required by law even after you delete your account; they are unlinked from your profile.</p>
      <h2>Your rights</h2>
      <ul>
        <li>Access and correct your data in the app, or by writing to us.</li>
        <li>Delete your account from <b>Profile → Delete my account</b> in the app, or see <a className="text-navy-700" href="/delete-account">Delete account</a>.</li>
        <li>Withdraw consent for notifications at any time in your phone’s settings.</li>
        <li>Raise a grievance with our Grievance Officer: {LEGAL.grievanceOfficer}, {LEGAL.grievanceEmail}. We respond within the time required by law.</li>
      </ul>
      <h2>Security</h2>
      <p>Data is encrypted in transit and at rest. Access is restricted by role and property, every sensitive change is audit-logged, and sign-in codes are single-use and expire in 10 minutes.</p>
      <h2>Contact</h2>
      <p>
        {LEGAL.entityName}, {LEGAL.address}. Email {LEGAL.supportEmail}.
      </p>
    </LegalPage>
  );
}
