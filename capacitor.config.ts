import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.priti.app',
  appName: 'Monitraq',
  webDir: 'dist',
  plugins: {
    WellueSDK: {
      // Plugin configuration if needed
    }
  },
  ios: {
    scheme: "App"
  },
  // Explicitly register WellueSDK plugin to prevent 'npx cap sync' from removing it
  packageClassList: [
    'WellueSDK',
    'BluetoothLe',
    'FilesystemPlugin',
    'ScreenOrientationPlugin',
    'SharePlugin'
  ] as any
};

export default config;
