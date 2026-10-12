const { withAndroidManifest } = require('expo/config-plugins');
// Existing prebuilds may retain the old explicit microphone-removal marker.
function enableDictationPermission(manifest) {
  const permissions = manifest['uses-permission'] ?? (manifest['uses-permission'] = []);
  let entry = permissions.find(item => item.$?.['android:name'] === 'android.permission.RECORD_AUDIO');
  if (!entry) { entry = { $: { 'android:name': 'android.permission.RECORD_AUDIO' } }; permissions.push(entry); }
  if (entry.$['tools:node'] === 'remove') delete entry.$['tools:node'];
  return manifest;
}
module.exports = config => withAndroidManifest(config, mod => { enableDictationPermission(mod.modResults.manifest); return mod; });
module.exports.enableDictationPermission = enableDictationPermission;
