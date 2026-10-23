import { router } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '@/src/session';
import { Body, Button, Card, H1, H2, Screen, Small } from '@/src/ui';

export default function DiscoverProfile() {
  const { mode, profile, signOut } = useSession();
  return (
    <Screen>
      <H1>Profile</H1>
      {mode === 'guest' ? (
        <Card style={{ gap: 10 }}>
          <H2>Sign in to THIKANO</H2>
          <Body>Save rooms, track your enquiries and — once you move in — manage your stay.</Body>
          <Button label="Sign in with mobile" icon="smartphone" onPress={() => router.push('/sign-in')} />
        </Card>
      ) : (
        <>
          <Card>
            <H2>{profile?.displayName || 'Student'}</H2>
            <Small>{profile?.phone ?? ''}</Small>
          </Card>
          <Card>
            <H2>Moving into a THIKANO PG?</H2>
            <Body>When your owner completes your move-in, this app switches to Resident mode automatically.</Body>
          </Card>
          <View style={{ marginTop: 8 }}>
            <Button label="Sign out" variant="secondary" icon="log-out" onPress={signOut} />
          </View>
        </>
      )}
    </Screen>
  );
}
