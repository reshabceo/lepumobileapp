#import <Capacitor/Capacitor.h>
#import <objc/runtime.h>

/**
 * Consolidated Plugin Registration for Monitraq App.
 * This file registers all native Swift plugins to the Capacitor bridge.
 */

// Constructor to verify that this file is being compiled and loaded
__attribute__((constructor)) static void _verifyPluginRegistration(void) {
    NSLog(@"🔧 [NATIVE REGISTRY] Monitraq native plugins registry initializing...");
    
    // Force link the Swift classes
    NSArray *classes = @[@"IAPPlugin", @"AliveCorSDK"];
    for (NSString *className in classes) {
        Class cls = NSClassFromString(className);
        if (!cls) {
            cls = NSClassFromString([NSString stringWithFormat:@"App.%@", className]);
        }
        if (!cls) {
            cls = NSClassFromString([NSString stringWithFormat:@"Monitraq.%@", className]);
        }
        
        if (cls) {
            NSLog(@"🔧 [NATIVE REGISTRY] ✅ Found class: %@", className);
            (void)[cls class];
        } else {
            NSLog(@"❌ [NATIVE REGISTRY] ⚠️ Could not find class: %@", className);
        }
    }
}

// Register IAPPlugin
CAP_PLUGIN(IAPPlugin, "IAPPlugin",
    CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(loadProducts, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(purchase, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(restorePurchases, CAPPluginReturnPromise);
)

// Register AliveCorSDK
CAP_PLUGIN(AliveCorSDK, "AliveCorSDK",
    CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startSixLeadRecording, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getDeviceStatus, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startScan, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopScan, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(connect, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestPermissions, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(dispose, CAPPluginReturnPromise);
)
