const { withAndroidManifest } = require('expo/config-plugins');

// Development may use a local fixture/Metro server. Distributed builds only use HTTPS.
module.exports = config => withAndroidManifest(config, mod => {
  if (['production', 'preview'].includes(process.env.EXPO_PUBLIC_APP_ENV)) {
    mod.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'false';
  }
  return mod;
});
