import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { color } from '@thikano/tokens';
import { ResidentProvider } from '@/src/resident';
import { Icon, type IconName } from '@/src/ui';

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color: c }: { color: ColorValue }) => <Icon name={icon} size={21} color={c as string} />,
});

export const unstable_settings = { initialRouteName: 'home' };

/** RESIDENT MODE — same app, switched on when the account has an active stay. */
export default function ResidentTabs() {
  return (
    <ResidentProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: color.navy[700],
          tabBarInactiveTintColor: color.ink[400],
          tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen name="home" options={tab('Home', 'home')} />
        <Tabs.Screen name="services" options={tab('Services', 'grid')} />
        <Tabs.Screen name="community" options={tab('Community', 'users')} />
        <Tabs.Screen name="stay" options={tab('My Stay', 'key')} />
        <Tabs.Screen name="profile" options={tab('Profile', 'user')} />
      </Tabs>
    </ResidentProvider>
  );
}
