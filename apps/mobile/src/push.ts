import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { firebase } from './firebase';

const INSTALL_KEY = 'thikano.installId';

async function installId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALL_KEY).catch(() => null);
  if (existing) return existing;
  const id = `i${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  await AsyncStorage.setItem(INSTALL_KEY, id).catch(() => undefined);
  return id;
}

/**
 * Registers this device for native push after sign-in. Android gets an FCM token, iOS an
 * APNs token (the server talks to each platform directly). Needs a development/production
 * build — Expo Go and the web build skip silently; the in-app inbox still works everywhere.
 */
export async function registerForPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (Platform.OS === 'android') {
      // Android 13+: a channel must exist before the token is requested.
      await Notifications.setNotificationChannelAsync('default', { name: 'THIKANO', importance: Notifications.AndroidImportance.HIGH });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;
    const token = await Notifications.getDevicePushTokenAsync();
    await firebase().call('registerDevice', { platform: Platform.OS, token: String(token.data), installId: await installId() });
  } catch {
    // Expo Go / simulators without push support: nothing to register.
  }
}

/** Show notifications while the app is open. */
export function configureForegroundNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}
