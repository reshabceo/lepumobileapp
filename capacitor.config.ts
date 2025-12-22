import type { CapacitorConfig } from '@capacitor/cli';

type IOSConfig = CapacitorConfig['ios'] & { packageClassList?: string[] };
type ExtendedCapacitorConfig = CapacitorConfig & { ios?: IOSConfig; packageClassList?: string[] };

const config: ExtendedCapacitorConfig = {
  appId: 'com.priti.app',
  appName: 'Monitraq',
  webDir: 'dist',
  plugins: {
    WellueSDK: {
      // Plugin configuration if needed
    },
    Camera: {
      androidMaxDimension: 1920
    },
    Permissions: {
      camera: {
        name: 'Camera'
      },
      storage: {
        name: 'Storage'
      }
    }
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  },
  ios: {
    scheme: "App",
    packageClassList: [
      'WellueSDK',
      'BluetoothLe',
      'FilesystemPlugin',
      'ScreenOrientationPlugin',
      'SharePlugin'
    ]
  },
  packageClassList: [
    'WellueSDK',
    'BluetoothLe',
    'FilesystemPlugin',
    'ScreenOrientationPlugin',
    'SharePlugin'
  ]
};

export default config;

