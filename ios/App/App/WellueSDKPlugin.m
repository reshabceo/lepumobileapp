#import <Capacitor/Capacitor.h>
#import <objc/runtime.h>

// CRITICAL: Force the WellueSDK class to be linked into the binary
// This ensures Capacitor can discover the plugin at runtime
// The class must be available when CAP_PLUGIN macro executes

// Forward declaration with proper prototype
static void _forceLinkWellueSDK(void);

// Force reference to ensure WellueSDK class is linked
// This ensures the Swift class is available to Objective-C runtime
__attribute__((used)) static void _forceLinkWellueSDK(void) {
    // Try multiple class name patterns to find the Swift class
    Class cls = NSClassFromString(@"WellueSDK");
    if (!cls) {
        cls = NSClassFromString(@"App.WellueSDK");
    }
    if (!cls) {
        cls = NSClassFromString(@"_TtC3App9WellueSDK");
    }
    
    // CRITICAL: Force the class to be loaded by accessing its metadata
    // This ensures the class is available when Capacitor's plugin registry is built
    if (cls) {
        // Access class metadata to force full initialization
        (void)[cls class];
        // Force method list to be loaded
        unsigned int methodCount = 0;
        class_copyMethodList(cls, &methodCount);
    }
    
    // Keep the reference to prevent optimization
    (void)cls;
}

// CRITICAL: Execute at library load time (before Capacitor initializes)
// This ensures the plugin class is available when CAP_PLUGIN macro registers it
__attribute__((constructor)) static void _registerWellueSDK(void) {
    _forceLinkWellueSDK();
}

CAP_PLUGIN(WellueSDK, "WellueSDK",
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

