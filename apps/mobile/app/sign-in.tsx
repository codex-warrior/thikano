import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { signInWithCustomToken } from 'firebase/auth';
import { color, radius } from '@thikano/tokens';
import { toFriendly } from '@thikano/client';
import { firebase } from '@/src/firebase';
import { useSession } from '@/src/session';
import { Body, Button, H1, Screen, Small } from '@/src/ui';

const PHONE_RE = /^[6-9]\d{9}$/;

/** Phone sign-in: requestOtp → verifyOtp → custom token (functions/src/identity.ts). */
export default function SignIn() {
  const { refresh } = useSession();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const r = await firebase().call<unknown, { challengeId: string; devCode?: string }>('requestOtp', { phone });
      setChallenge(r.challengeId);
      setDevCode(r.devCode ?? null);
    } catch (e) {
      setError(toFriendly(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const { token } = await firebase().call<unknown, { token: string }>('verifyOtp', { challengeId: challenge, code });
      await signInWithCustomToken(firebase().auth, token);
      await refresh();
      if (router.canGoBack()) router.back();
    } catch (e) {
      setError(toFriendly(e));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={[]}>
        {!challenge ? (
          <>
            <H1>What&apos;s your mobile number?</H1>
            <Body>We&apos;ll send a one-time code to verify it.</Body>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: color.borderStrong, borderRadius: radius.md, backgroundColor: color.surface, height: 54, paddingHorizontal: 14 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: color.ink[700], marginRight: 10 }}>+91</Text>
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder="98XXXXXXXX"
                placeholderTextColor={color.ink[300]}
                style={{ flex: 1, fontSize: 17, color: color.ink[900], letterSpacing: 1 }}
                accessibilityLabel="Mobile number"
              />
            </View>
            {error ? <Text style={{ color: color.danger[600], fontWeight: '600' }}>{error}</Text> : null}
            <Button label={busy ? 'Sending…' : 'Send code'} disabled={!PHONE_RE.test(phone) || busy} onPress={send} />
          </>
        ) : (
          <>
            <H1>Enter the code</H1>
            <Body>Sent to +91 {phone}</Body>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              placeholder="••••••"
              placeholderTextColor={color.ink[300]}
              style={{ height: 58, borderWidth: 1, borderColor: color.borderStrong, borderRadius: radius.md, backgroundColor: color.surface, fontSize: 26, letterSpacing: 12, textAlign: 'center', color: color.ink[900] }}
              accessibilityLabel="One-time code"
              autoFocus
            />
            {devCode ? <Small style={{ textAlign: 'center' }}>Local emulator code: {devCode}</Small> : null}
            {error ? <Text style={{ color: color.danger[600], fontWeight: '600' }}>{error}</Text> : null}
            <Button label={busy ? 'Verifying…' : 'Verify & continue'} disabled={code.length !== 6 || busy} onPress={verify} />
            <Pressable onPress={() => (setChallenge(null), setCode(''), setError(null))} style={{ alignItems: 'center', padding: 6 }}>
              <Text style={{ color: color.navy[700], fontWeight: '600' }}>Change number</Text>
            </Pressable>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
