#import <Capacitor/Capacitor.h>

/**
 * Register the IAP Plugin to the Capacitor Bridge.
 * This file exposes the Swift methods to JavaScript.
 */
CAP_PLUGIN(IAP, "IAP",
           CAP_PLUGIN_METHOD(loadProducts, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(purchase, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(restorePurchases, CAPPluginReturnPromise);
)
