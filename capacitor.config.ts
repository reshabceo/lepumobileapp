import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.priti.app',
  appName: 'pritimedicalapp',
  webDir: 'dist',
  plugins: {
    WellueSDK: {
      // Plugin configuration if needed
    }
  }
};

export default config;
