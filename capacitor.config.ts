import type { CapacitorConfig } from '@capacitor/cli';

type IOSConfig = CapacitorConfig['ios'] & { packageClassList?: string[] };
type ExtendedCapacitorConfig = CapacitorConfig & { ios?: IOSConfig; packageClassList?: string[] };

const config: ExtendedCapacitorConfig = {
  appId: 'com.monitraq.mobile',
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
    },
    CapacitorHttp: {
      enabled: true
    }
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    flavor: 'production'
  },
  ios: {
    scheme: "App",
    packageClassList: [
      'WellueSDK',
      'IAPPlugin',
      'Bp2',
      'AliveCorSDK',
      'BluetoothLe',
      'FilesystemPlugin',
      'ScreenOrientationPlugin',
      'SharePlugin'
    ]
  },
  packageClassList: [
    'WellueSDK',
    'IAPPlugin',
    'Bp2',
    'AliveCorSDK',
    'BluetoothLe',
    'FilesystemPlugin',
    'ScreenOrientationPlugin',
    'SharePlugin'
  ]
};

export default config;

