#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>
#import <objc/runtime.h>
#import <VTMProductLib/VTMURATUtils.h>
#import <CoreBluetooth/CoreBluetooth.h>

// Keys for associated objects
static char const * const kTxCharacteristicKey = "kTxCharacteristicKey";
static char const * const kRxCharacteristicKey = "kRxCharacteristicKey";

@implementation VTMURATUtils (WriteProperties)

- (void)setTxcharacteristic:(CBCharacteristic *)txcharacteristic {
    objc_setAssociatedObject(self, kTxCharacteristicKey, txcharacteristic, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    Ivar ivar = class_getInstanceVariable([VTMURATUtils class], "_txcharacteristic");
    if (ivar) {
        object_setIvar(self, ivar, txcharacteristic);
    }
}

- (CBCharacteristic *)txcharacteristic {
    CBCharacteristic *charac = objc_getAssociatedObject(self, kTxCharacteristicKey);
    if (charac) {
        return charac;
    }
    Ivar ivar = class_getInstanceVariable([VTMURATUtils class], "_txcharacteristic");
    if (ivar) {
        return object_getIvar(self, ivar);
    }
    return nil;
}

- (void)setRxcharacteristic:(CBCharacteristic *)rxcharacteristic {
    objc_setAssociatedObject(self, kRxCharacteristicKey, rxcharacteristic, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    Ivar ivar = class_getInstanceVariable([VTMURATUtils class], "_rxcharacteristic");
    if (ivar) {
        object_setIvar(self, ivar, rxcharacteristic);
    }
}

- (CBCharacteristic *)rxcharacteristic {
    CBCharacteristic *charac = objc_getAssociatedObject(self, kRxCharacteristicKey);
    if (charac) {
        return charac;
    }
    Ivar ivar = class_getInstanceVariable([VTMURATUtils class], "_rxcharacteristic");
    if (ivar) {
        return object_getIvar(self, ivar);
    }
    return nil;
}

@end

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
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
           CAP_PLUGIN_METHOD(getBondedDevices, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getConnectedDevices, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isDeviceConnected, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getBp2FileList, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(bp2ReadFile, CAPPluginReturnPromise);
)


