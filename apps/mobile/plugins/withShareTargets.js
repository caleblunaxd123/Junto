const { withAndroidManifest, withInfoPlist } = require("expo/config-plugins");

function addWhatsAppQuery(manifest) {
  const queries = manifest.manifest.queries ||= [{}];
  const intents = queries[0].intent ||= [];
  if (!intents.some(intent => intent.action?.some(action => action.$?.["android:name"] === "android.intent.action.VIEW") && intent.data?.some(data => data.$?.["android:scheme"] === "whatsapp"))) {
    intents.push({ action: [{ $: { "android:name": "android.intent.action.VIEW" } }], data: [{ $: { "android:scheme": "whatsapp" } }] });
  }
  return manifest;
}

function withShareTargets(config) {
  config = withAndroidManifest(config, mod => { addWhatsAppQuery(mod.modResults); return mod; });
  return withInfoPlist(config, mod => {
    mod.modResults.LSApplicationQueriesSchemes = [...new Set([...(mod.modResults.LSApplicationQueriesSchemes || []), "whatsapp"])];
    return mod;
  });
}

module.exports = withShareTargets;
module.exports.addWhatsAppQuery = addWhatsAppQuery;
