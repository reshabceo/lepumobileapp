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
#import <VTMProductLib/VTO2Communicate.h>
#import <VTMProductLib/VTO2Parser.h>
#import <VTMProductLib/VTO2Info.h>
#import <VTMProductLib/VTO2Object.h>
#import <VTMProductLib/VTRealObject.h>
#import <VTMProductLib/VTMCalibrate.h>

@interface VTMURATUtils (WriteProperties)
@property (nonatomic, assign, readwrite) VTMDeviceType currentType;
@property (nonatomic, strong, readwrite) CBCharacteristic *txcharacteristic;
@property (nonatomic, strong, readwrite) CBCharacteristic *rxcharacteristic;
@property (nonatomic, strong, readonly) VTMBLEDevice * _Nullable bleDevice;
@end

@interface VTMBLEDevice : NSObject
@property (nonatomic, strong) CBCharacteristic *a5_TxCharacteristic;
@property (nonatomic, strong) CBCharacteristic *a5_RxCharacteristic;
@property (nonatomic, strong) CBCharacteristic *aa_TxCharacteristic;
@property (nonatomic, strong) CBCharacteristic *aa_RxCharacteristic;
@end


