import { Card, SectionHeader } from '@thikano/web-ui';
import { GrantRoleForm } from '@/components/admin-actions';
import { PageHeader } from '@/components/table';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await requireAdmin();
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Platform configuration" />
      <Card className="p-5">
        <SectionHeader title="Platform staff" subtitle="Admins can approve properties and see economics. Support can view and help, with masked phone numbers." />
        <GrantRoleForm />
      </Card>
      <Card className="p-5 text-[13.5px] text-ink-500">
        <SectionHeader title="Production dependencies" />
        <ul className="list-disc space-y-1 pl-5">
          <li>SMS provider for phone sign-in (SMS_PROVIDER + credentials, OTP_HMAC_SECRET)</li>
          <li>Payment gateway (Razorpay/Cashfree keys + webhook secret)</li>
          <li>Dwarpar API (DWARPAR_API_BASE, DWARPAR_API_KEY)</li>
          <li>App Check (THIKANO_ENFORCE_APP_CHECK=true) and FCM APNs key for iOS push</li>
        </ul>
      </Card>
    </div>
  );
}
