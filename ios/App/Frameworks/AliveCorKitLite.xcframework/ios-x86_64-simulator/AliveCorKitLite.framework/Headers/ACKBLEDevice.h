//
//  ACKBLEDevice.h
//  AliveCorKitExample
//
//  Created by Ishan Vijay Alone on 27/06/25.
//  Copyright © 2025 AliveCor. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKConstants.h>

@protocol BLEDeviceDelegateHandler <NSObject>
- (void)bleDeviceUpdatedWithBatteryLevel:(NSUInteger)batteryLevel;
- (void)bleDeviceUpdatedWithBluetoothRSSI:(float)bluetoothRSSI;
- (void)bleDeviceCaptureEnabled;
- (void)bleDevicePropertiesUpdated;

@end

NS_ASSUME_NONNULL_BEGIN
@class ACBLEDevice;
@class ACKBluetoothDeviceProperties;




@interface ACKBLEDevice : NSObject

- (instancetype)initWithACBLEDevice:(ACBLEDevice *) device andBleDeviceHandler:(nullable id<BLEDeviceDelegateHandler>) handler;

/**
 * @return The hardware device type (kardia_6l or kardia_card).
 */
- (NSString *)bleDeviceHardwareName;

/**
 * Start capturing ECG samples and Audio (if enabled).  BLEDevice's enableCapture: must be called to unlock the
 * device and activate capture mode.
 */
- (void)startCapturing;

/**
 * Stop capturing data from device.
 */
- (void)stopCapturing;

/**
 * Unlock and enable ECG capture.
 *
 * @param mode The ECG mode.
 * @param voiceRecordingEnabled Should we record audio or not?
 */
- (void)enableCaptureWithMode:(ACKBluetoothECGMode)mode
        voiceRecordingEnabled:(BOOL)voiceRecordingEnabled;

- (NSUUID *)uuid;
- (nullable ACKBluetoothDeviceProperties *)deviceProperties;
- (NSString *)name;
- (ACBLEDevice *)bleDevice;

@end

NS_ASSUME_NONNULL_END

