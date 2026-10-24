import { router } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color } from '@thikano/tokens';
import { useSession } from '@/src/session';
import { Button, Icon, type IconName } from '@/src/ui';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'image', title: 'See the actual room', body: 'Real photos, real rent, live bed availability.' },
  { icon: 'map-pin', title: 'Near your college', body: 'Search by area or college and compare PGs.' },
  { icon: 'home', title: 'Live better after you move in', body: 'Rent, food, laundry and notices — all in Habistat.' },
];

/** First-run onboarding. */
export default function Onboarding() {
  const { finishOnboarding } = useSession();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.navy[900] }}>
      <View style={{ flex: 1, padding: 28, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('@/assets/images/logo-mark-light.png')} style={{ width: 30, height: 27 }} accessibilityIgnoresInvertColors />
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.2 }}>Habistat</Text>
        </View>
        <View style={{ gap: 28 }}>
          <Text style={{ color: '#fff', fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -0.6 }}>Find your PG.{'\n'}See the actual room.</Text>
          <View style={{ gap: 18 }}>
            {POINTS.map((p) => (
              <View key={p.title} style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={p.icon} color={color.accent[500]} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{p.title}</Text>
                  <Text style={{ color: color.navy[200], fontSize: 13.5, lineHeight: 19, marginTop: 2 }}>{p.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12 }}>
            <Button
              label="Find a PG"
              variant="ghost"
              onPress={() => {
                finishOnboarding();
                router.replace('/explore');
              }}
            />
          </View>
          <Pressable
            onPress={() => {
              finishOnboarding();
              router.replace('/explore');
              setTimeout(() => router.push('/sign-in'), 0);
            }}
            style={{ alignItems: 'center', padding: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>I live in a Habistat PG · Sign in</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
