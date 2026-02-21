//
//  ACKDevice.h
//  AliveCorKit
//
//  Created by Alex Vlasenko on 12/13/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <AliveCorKitLite/ACKTypes.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Represents metadata about the physical device used to record an ECG.
 *
 * @discussion
 * This class encapsulates identifying and diagnostic information for AliveCor
 * ECG devices, such as hardware/firmware revisions, serial numbers, and battery
 * level. Availability of certain fields depends on the device type.
 */
@interface ACKDevice : NSObject

/// The hardware type used to record the ECG.
@property (nonatomic, readonly) ACKDeviceType deviceType;

/// Hardware revision identifier.
/// Available only for `ACKDeviceTypeTriangle` and `ACKDeviceTypeCard`.
@property (nonatomic, copy, readonly, nullable) NSString *hardwareRevision;

/// Firmware revision identifier.
/// Available only for `ACKDeviceTypeTriangle` and `ACKDeviceTypeCard`.
@property (nonatomic, copy, readonly, nullable) NSString *firmwareRevision;

/// Device serial number.
/// Available only for `ACKDeviceTypeTriangle` and `ACKDeviceTypeCard`.
@property (nonatomic, copy, readonly, nullable) NSString *serialNumber;

/// Bluetooth identifier (if applicable).
/// Available only for Bluetooth-capable devices.
@property (nonatomic, copy, readonly, nullable) NSString *bluetoothId;

/// Human-readable device name.
@property (nonatomic, copy, readonly, nullable) NSString *deviceName;

/// Current battery level (0–100).
/// Available only for `ACKDeviceTypeTriangle` and `ACKDeviceTypeCard`.
@property (nonatomic, readonly) CGFloat batteryLevel;

/// Unique device identifier (UUID string).
/// Available only for `ACKDeviceTypeTriangle` and `ACKDeviceTypeCard`.
@property (nonatomic, copy, readonly, nullable) NSString *uuid;

#pragma mark - Initializers

/// Initializes a new device instance with the specified device type.
- (instancetype)initWithDeviceType:(ACKDeviceType)deviceType;

/// Initializes a new device instance with the specified type and UUID.
- (instancetype)initWithDeviceType:(ACKDeviceType)deviceType
                              uuid:(nullable NSString *)uuid;

/// Initializes a new device instance with the specified hardware metadata.
- (instancetype)initWithDeviceType:(ACKDeviceType)deviceType hardwareRevision:(nullable NSString *)hardwareRevision firmwareRevision:(nullable NSString *)firmwareRevision  serialNumber:(nullable NSString *)serialNumber batteryLevel:(CGFloat)batteryLevel uuid:(nullable NSString *)uuid bluetoothId:(nullable NSString *)bluetoothId deviceName:(nullable NSString *)deviceName;

- (instancetype)init NS_UNAVAILABLE;

#pragma mark - Helpers

/// Returns `YES` if the receiver represents a BLE variant of a Triangle device.
- (BOOL)isTriangleDeviceVariant;

/// Returns `YES` if the device supports Bluetooth Low Energy (BLE) communication.
- (BOOL)isBLEDevice;

/// Returns `YES` if the given type represents a BLE variant of a Triangle device.
+ (BOOL)isTriangleDeviceVariantType:(ACKDeviceType)deviceType;

/// Returns `YES` if the given type supports Bluetooth Low Energy (BLE).
+ (BOOL)isBLEDeviceType:(ACKDeviceType)deviceType;

/// Returns the default display name for the given device type.
+ (NSString *)deviceNameFromType:(ACKDeviceType)type;

@end

NS_ASSUME_NONNULL_END
