import { Card } from '@thikano/web-ui';
import { SettingsForms } from '@/components/settings-forms';
import { requireOwner } from '@/lib/session';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const session = await requireOwner();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-[26px] font-bold">Settings</h1>
      <SettingsForms orgId={session.orgId} orgName={session.orgName} name={session.name} isOwner={session.member.role === 'owner'} />
      <Card className="p-5 text-[13.5px] text-ink-500">
        Signed in as <b className="text-ink-900">{session.email ?? session.name}</b> · {session.member.role}
      </Card>
    </div>
  );
}
