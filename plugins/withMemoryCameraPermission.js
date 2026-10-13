const { withAndroidManifest } = require('expo/config-plugins');

// Expo prebuild reuses AndroidManifest.xml. Remove the old blocker left by
// expo-image-picker when cameraPermission used to be false.
module.exports = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const permissions = manifest['uses-permission'] ?? [];
    manifest['uses-permission'] = permissions.filter(
      (item) => item.$?.['android:name'] !== 'android.permission.CAMERA',
    );
    manifest['uses-permission'].push({
      $: { 'android:name': 'android.permission.CAMERA' },
    });
    return mod;
  });
