import { existsSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json. Firebase native config files are added only when present, so
 * development builds work before the production Firebase project exists:
 *   apps/mobile/google-services.json      (Android — from Firebase console)
 *   apps/mobile/GoogleService-Info.plist  (iOS — optional; iOS push uses APNs directly)
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: { ...config.android, ...(existsSync('./google-services.json') ? { googleServicesFile: './google-services.json' } : {}) },
  ios: { ...config.ios, ...(existsSync('./GoogleService-Info.plist') ? { googleServicesFile: './GoogleService-Info.plist' } : {}) },
  // Google Sign-In iOS URL scheme (reversed iOS client ID) — added once the iOS OAuth client exists.
  plugins: [
    ...(config.plugins ?? []),
    ...(process.env.GOOGLE_IOS_URL_SCHEME ? [['@react-native-google-signin/google-signin', { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME }] as [string, object]] : []),
  ],
  extra: { ...config.extra, eas: { projectId: process.env.EAS_PROJECT_ID } },
});
