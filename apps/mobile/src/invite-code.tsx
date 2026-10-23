import { useState } from 'react';
import { Text } from 'react-native';
import { color } from '@thikano/tokens';
import { toFriendly } from '@thikano/client';
import { firebase } from './firebase';
import { useSession } from './session';
import { Body, Button, Card, H2, Input } from './ui';

/** "I live here": redeem the invite code from the owner → Resident mode. */
export function InviteCodeCard() {
  const { refresh } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function claim() {
    setBusy(true);
    setError(null);
    try {
      await firebase().call('claimResidentInvite', { code });
      await refresh(); // token now carries the stay claim → app switches to Resident mode
    } catch (e) {
      setError(toFriendly(e));
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: 10 }}>
      <H2>I live in a THIKANO PG</H2>
      <Body>Enter the invite code your PG shared with you.</Body>
      <Input label="Invite code" value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} autoCapitalize="characters" autoCorrect={false} placeholder="ABCD2345" />
      {error ? <Text style={{ color: color.danger[600], fontWeight: '600' }}>{error}</Text> : null}
      <Button label={busy ? 'Linking…' : 'Link my stay'} disabled={code.length < 6 || busy} onPress={claim} />
    </Card>
  );
}
