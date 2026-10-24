import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { color } from '@thikano/tokens';
import { toFriendly } from '@thikano/client';
import { firebase } from './firebase';
import { useSession } from './session';
import { Body, Button, Input, Sheet, Small } from './ui';

/** In-app account deletion (Google Play requirement; DPDP Act right to erasure). */
export function DeleteAccount() {
  const { signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await firebase().call('deleteAccount', { confirm: 'DELETE' });
      await signOut();
    } catch (e) {
      setError(toFriendly(e));
      setBusy(false);
    }
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={{ alignItems: 'center', padding: 12 }} accessibilityRole="button">
        <Text style={{ color: color.danger[600], fontWeight: '600' }}>Delete my account</Text>
      </Pressable>
      <Sheet visible={open} title="Delete your account?" onClose={() => setOpen(false)}>
        <Body>Your profile, devices and notifications are deleted. Enquiries you sent are anonymised. Rent receipts your PG must keep by law stay with the PG, without your name or number.</Body>
        <Small>If you live in a Habistat PG, your owner must complete your move-out first.</Small>
        <Input label="Type DELETE to confirm" value={typed} onChangeText={setTyped} autoCapitalize="characters" />
        {error ? <Text style={{ color: color.danger[600], fontWeight: '600' }}>{error}</Text> : null}
        <Button label={busy ? 'Deleting…' : 'Delete account'} disabled={typed !== 'DELETE' || busy} onPress={remove} />
      </Sheet>
    </>
  );
}
