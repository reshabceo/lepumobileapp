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
  }
};

export default config;
