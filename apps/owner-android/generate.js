// Regenerates this Habistat Owner TWA project (Android wrapper around the owner console) from the live
// web manifest. Package com.habistat.owner, signed with the mobile upload key — its SHA-256 is in
// apps/owner/public/.well-known/assetlinks.json. Run from a folder with @bubblewrap/core@1.27.0 installed:
//   node generate.js <out-dir> <path-to-upload-keystore.jks>
// then raise minSdkVersion to 24 in app/build.gradle (androidbrowserhelper needs it), build with
// ./gradlew assembleRelease (JDK 17-21, e.g. the Android Studio JBR), zipalign and apksigner sign.
const { TwaManifest, TwaGenerator, ConsoleLog } = require('@bubblewrap/core');
const [, , out, keystore] = process.argv;
(async () => {
  const m = await TwaManifest.fromWebManifest('https://owner--thikano-prod.asia-southeast1.hosted.app/manifest.webmanifest');
  m.packageId = 'com.habistat.owner';
  m.name = 'Habistat Owner';
  m.launcherName = 'Habistat Owner';
  m.appVersionName = '1.0.0';
  m.appVersionCode = 1;
  m.signingKey = { path: keystore, alias: 'thikano' };
  m.fallbackType = 'customtabs';
  m.enableNotifications = false;
  await new TwaGenerator().createTwaProject(out, m, new ConsoleLog('gen'));
  require('fs').writeFileSync(require('path').join(out, 'twa-manifest.json'), JSON.stringify(m.toJson(), null, 2));
  console.log('generated', out);
})().catch((e) => { console.error(e); process.exit(1); });
