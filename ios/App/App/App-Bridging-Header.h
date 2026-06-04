//
//  App-Bridging-Header.h
//  App
//
//  Use this file to import Objective-C headers for Swift access.
//

// This bridging header allows Swift to see Objective-C code
// The WellueSDKPlugin is registered via Objective-C macro in WellueSDKPlugin.m

#import <Capacitor/Capacitor.h>
#import <VTMProductLib/VTMURATUtils.h>

@interface VTMURATUtils (WriteProperties)
@property (nonatomic, assign, readwrite) VTMDeviceType currentType;
@property (nonatomic, strong, readwrite) CBCharacteristic *txcharacteristic;
@property (nonatomic, strong, readwrite) CBCharacteristic *rxcharacteristic;
@end

