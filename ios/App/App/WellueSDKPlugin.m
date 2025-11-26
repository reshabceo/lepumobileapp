#import <Capacitor/Capacitor.h>

CAP_PLUGIN(WellueSDKPlugin, "LepuSDK",
           CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isBluetoothEnabled, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(startScan, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopScan, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(connect, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(disconnect, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(startBPMeasurement, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(startECGMeasurement, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopMeasurement, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(startRtTaskForConnectedDevice, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getBatteryLevel, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getConnectedDevices, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isDeviceConnected, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getBondedDevices, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getBp2FileList, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(bp2ReadFile, CAPPluginReturnPromise);
)

