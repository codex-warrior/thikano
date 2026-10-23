import { View } from 'react-native';
import { useResident } from '@/src/resident';
import { DeleteAccount } from '@/src/delete-account';
import { useSession } from '@/src/session';
import { Button, Card, H1, H2, Screen, Small } from '@/src/ui';

export default function ResidentProfile() {
  const { profile, signOut } = useSession();
  const { data: h } = useResident();
  return (
    <Screen>
      <H1>Profile</H1>
      <Card>
        <H2>{h?.resident.name ?? profile?.displayName ?? 'Resident'}</H2>
        <Small>
          {profile?.phone ?? ''}
          {h ? ` · Resident at ${h.property.name}` : ''}
        </Small>
      </Card>
      <View style={{ marginTop: 8 }}>
        <Button label="Sign out" variant="secondary" icon="log-out" onPress={signOut} />
      </View>
      <DeleteAccount />
    </Screen>
  );
}
