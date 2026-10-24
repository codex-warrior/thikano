import { LegalPage } from '@/components/legal-page';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Terms of Use' };

export default function Terms() {
  return (
    <LegalPage title="Terms of Use">
      <p>These terms govern your use of Habistat, operated by {LEGAL.entityName}. By using Habistat you agree to them.</p>
      <h2>What Habistat is</h2>
      <p>
        Habistat is a technology platform that helps students find PGs and hostels, helps residents manage their stay, and helps owners run their property. The accommodation itself is
        provided by the property owner, not by Habistat. Your stay is governed by your agreement with the owner and the house rules shown on the property page.
      </p>
      <h2>Listings</h2>
      <ul>
        <li>Owners are responsible for the accuracy of photos, rent, deposits, amenities and rules they publish.</li>
        <li>Habistat verifies properties before they appear in search, but verification is not a guarantee of the stay.</li>
        <li>Availability is updated automatically from the owner’s bed records and may change at any time until a bed is booked.</li>
      </ul>
      <h2>Your account</h2>
      <ul>
        <li>Keep your phone and sign-in codes private. You are responsible for activity on your account.</li>
        <li>Do not misuse Habistat: no false enquiries, spam, scraping, or attempts to access other people’s data.</li>
        <li>We may suspend accounts or listings that break these terms or the law.</li>
      </ul>
      <h2>Payments</h2>
      <p>
        Online rent and service payments are processed by our payment partner. Rent is payable to your PG; Habistat facilitates collection and issues receipts. Service orders are fulfilled by
        the listed provider. See the <a className="text-navy-700" href="/refunds">Refund &amp; Cancellation Policy</a>.
      </p>
      <h2>Liability</h2>
      <p>To the extent permitted by law, Habistat is not liable for disputes between residents and owners or for the services of third-party providers. We will help mediate through support.</p>
      <h2>Changes and law</h2>
      <p>We may update these terms and will notify you of material changes. These terms are governed by the laws of India; courts at [City] have jurisdiction.</p>
      <h2>Contact</h2>
      <p>
        {LEGAL.supportEmail} · Grievance Officer: {LEGAL.grievanceOfficer}, {LEGAL.grievanceEmail}
      </p>
    </LegalPage>
  );
}
