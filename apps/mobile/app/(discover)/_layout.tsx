import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { color } from '@thikano/tokens';
import { Icon, type IconName } from '@/src/ui';

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color: c }: { color: ColorValue }) => <Icon name={icon} size={21} color={c as string} />,
});

export const unstable_settings = { initialRouteName: 'explore' };

/** DISCOVER MODE — students before joining a property. */
export default function DiscoverTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.navy[700],
        tabBarInactiveTintColor: color.ink[400],
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="explore" options={tab('Explore', 'search')} />
      <Tabs.Screen name="saved" options={tab('Saved', 'heart')} />
      <Tabs.Screen name="me" options={tab('Profile', 'user')} />
    </Tabs>
  );
}
