const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

// Consultas limitadas aos navegadores usados pelo app, sem QUERY_ALL_PACKAGES.
module.exports = function withExternalNavigation(config) {
  config = withInfoPlist(config, value => {
    value.modResults.LSApplicationQueriesSchemes = [...new Set([...(value.modResults.LSApplicationQueriesSchemes || []), 'comgooglemaps', 'waze'])];
    return value;
  });
  return withAndroidManifest(config, value => {
    const manifest = value.modResults.manifest;
    manifest.queries = manifest.queries || [{}];
    const queries = manifest.queries[0];
    queries.intent = queries.intent || [];
    for (const scheme of ['google.navigation', 'waze']) {
      if (!queries.intent.some(intent => intent.data?.some(data => data.$?.['android:scheme'] === scheme))) {
        queries.intent.push({ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:scheme': scheme } }] });
      }
    }
    return value;
  });
};
