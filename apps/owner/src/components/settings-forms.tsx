'use client';

import { doc, updateDoc } from 'firebase/firestore';
import { Button, Card } from '@thikano/web-ui';
import { useAction } from '@/lib/use-action';
import { useMutation } from '@/lib/use-mutation';
import { Field, FormError } from './form';

export function SettingsForms({ orgId, orgName, name, isOwner }: { orgId: string; orgName: string; name: string; isOwner: boolean }) {
  const org = useMutation(async (fb, n: string) => updateDoc(doc(fb.db, `organizations/${orgId}`), { name: n, updatedAt: Date.now() }));
  const profile = useAction<{ displayName: string }>('updateProfile');
  return (
    <>
      {isOwner ? (
        <Card className="p-5">
          <form
            className="flex items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              org.run(String(new FormData(e.currentTarget).get('name')));
            }}
          >
            <Field className="flex-1" label="Business name" name="name" defaultValue={orgName} required minLength={2} />
            <Button type="submit" disabled={org.busy}>
              Save
            </Button>
          </form>
          <FormError error={org.error} />
        </Card>
      ) : null}
      <Card className="p-5">
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            profile.run({ displayName: String(new FormData(e.currentTarget).get('displayName')) });
          }}
        >
          <Field className="flex-1" label="Your name" name="displayName" defaultValue={name} required minLength={2} />
          <Button type="submit" disabled={profile.busy}>
            Save
          </Button>
        </form>
        <FormError error={profile.error} />
      </Card>
    </>
  );
}
