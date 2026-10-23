import { LegalPage } from '@/components/legal-page';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Contact' };

export default function Contact() {
  return (
    <LegalPage title="Contact us">
      <p>We’re here to help students, residents and PG owners.</p>
      <h2>Support</h2>
      <ul>
        <li>Email: {LEGAL.supportEmail}</li>
        <li>Phone: {LEGAL.supportPhone} (Monday–Saturday, 10 AM–7 PM IST)</li>
      </ul>
      <h2>Grievance Officer</h2>
      <p>
        {LEGAL.grievanceOfficer} · {LEGAL.grievanceEmail}
      </p>
      <h2>Registered office</h2>
      <p>
        {LEGAL.entityName}
        <br />
        {LEGAL.address}
      </p>
      <h2>List your PG</h2>
      <p>PG and hostel owners can write to {LEGAL.supportEmail} to get started with THIKANO Owner.</p>
    </LegalPage>
  );
}
