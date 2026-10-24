import { LegalPage } from '@/components/legal-page';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Delete your Habistat account' };

/** Public account-deletion page (Google Play requires a web URL for deletion requests). */
export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your Habistat account">
      <h2>In the app (fastest)</h2>
      <ul>
        <li>Open Habistat → Profile → <b>Delete my account</b>, type DELETE and confirm.</li>
        <li>Your account is deleted immediately.</li>
      </ul>
      <h2>By email</h2>
      <p>
        Write to {LEGAL.supportEmail} from the email or mention the mobile number on your account. We verify ownership and delete it within 7 days.
      </p>
      <h2>What is deleted</h2>
      <ul>
        <li>Your profile, sign-in, devices and notifications.</li>
        <li>Your name and number on enquiries you sent (anonymised).</li>
      </ul>
      <h2>What is kept</h2>
      <ul>
        <li>Rent invoices and payment receipts your PG must keep by law, unlinked from your account and without your name or number.</li>
        <li>Audit logs needed for security, without your profile details.</li>
      </ul>
      <p>If you currently live in a Habistat PG, your owner must complete your move-out before the account can be deleted. Owners can close their business account through support.</p>
    </LegalPage>
  );
}
