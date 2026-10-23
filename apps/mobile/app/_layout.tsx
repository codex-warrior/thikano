import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { color } from '@thikano/tokens';
import { SessionProvider, useSession, type Mode } from '@/src/session';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <RootStack />
    </SessionProvider>
  );
}

const HOME: Record<Exclude<Mode, 'loading'>, '/explore' | '/home'> = { guest: '/explore', student: '/explore', resident: '/home' };

/**
 * One app, two modes. Discover for guests/students, Resident when the account has an
 * active stay. Guards are UX only — data access is enforced by Firestore rules + functions.
 */
function RootStack() {
  const { mode, onboarded } = useSession();
  const prev = useRef<Mode>('loading');
  useEffect(() => {
    if (mode !== 'loading') SplashScreen.hideAsync();
    const from = prev.current;
    prev.current = mode;
    // Land on the right home when the mode changes (sign-in, move-in, sign-out).
    if (mode !== 'loading' && from !== 'loading' && from !== mode) {
      const id = setTimeout(() => router.replace(HOME[mode]), 0);
      return () => clearTimeout(id);
    }
  }, [mode]);
  if (mode === 'loading') return null;
  const discover = mode === 'guest' || mode === 'student';
  const header = { headerShown: true, title: '', headerShadowVisible: false, headerStyle: { backgroundColor: color.bg } };
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
      <Stack.Protected guard={discover && !onboarded}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={discover}>
        <Stack.Screen name="(discover)" />
        <Stack.Screen name="property/[id]" options={header} />
        <Stack.Screen name="room/[slug]" options={header} />
      </Stack.Protected>
      <Stack.Protected guard={mode === 'guest'}>
        <Stack.Screen name="sign-in" options={{ ...header, presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={mode === 'resident'}>
        <Stack.Screen name="(resident)" />
      </Stack.Protected>
    </Stack>
  );
}
