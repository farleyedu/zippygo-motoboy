const { withAppBuildGradle, withProjectBuildGradle, withAppDelegate } = require('expo/config-plugins');
module.exports = function withNativeNavigation(config) {
  config = withProjectBuildGradle(config, value => {
    if (!value.modResults.contents.includes("module: 'play-services-maps'")) value.modResults.contents += "\nallprojects { configurations.configureEach { exclude group: 'com.google.android.gms', module: 'play-services-maps' } }\n";
    return value;
  });
  const iosKey = process.env.EXPO_PUBLIC_GOOGLE_NAVIGATION_IOS_API_KEY || config.ios?.config?.googleMapsApiKey;
  if (iosKey) config = withAppDelegate(config, value => {
    if (value.modResults.language === 'swift' && !value.modResults.contents.includes('GMSServices.provideAPIKey')) {
      value.modResults.contents = 'import GoogleMaps\n' + value.modResults.contents;
      value.modResults.contents = value.modResults.contents.replace(/(didFinishLaunchingWithOptions[\s\S]*?-> Bool\s*\{)/, '$1\n    GMSServices.provideAPIKey(' + JSON.stringify(iosKey) + ')');
    }
    return value;
  });
  return withAppBuildGradle(config, value => {
    if (!value.modResults.contents.includes('coreLibraryDesugaringEnabled true')) value.modResults.contents = value.modResults.contents.replace(/android\s*\{/, 'android {\n    compileOptions { coreLibraryDesugaringEnabled true }');
    value.modResults.contents = value.modResults.contents.replace(/com.android.tools:desugar_jdk_libs:/g, 'com.android.tools:desugar_jdk_libs_nio:');
    if (!value.modResults.contents.includes('desugar_jdk_libs_nio')) value.modResults.contents = value.modResults.contents.replace(/dependencies\s*\{/, "dependencies {\n    coreLibraryDesugaring('com.android.tools:desugar_jdk_libs_nio:2.1.5')");
    return value;
  });
};
