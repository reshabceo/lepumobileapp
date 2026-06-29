//
//  ACKBluetoothPairingControllerDelegate.h
//  AliveCorKitExample
//
//  Created by Alex Vlasenko on 5/17/20.
//  Copyright © 2020 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKTypes.h>

NS_ASSUME_NONNULL_BEGIN

@class ACKDevice;
@class ACKError;
@class ACKBluetoothPairingController;

/**
 * Defines the delegate methods for monitoring and responding to Bluetooth pairing events.
 *
 * @discussion
 * The `ACKBluetoothPairingControllerDelegate` protocol provides callbacks that inform
 * the delegate about Bluetooth availability, device discovery, successful pairing,
 * and connection errors during the pairing process.
 */
@protocol ACKBluetoothPairingControllerDelegate <NSObject>

/// Called when the Bluetooth controller is powered on and ready to scan for devices.
/// @param bluetoothDeviceController The Bluetooth pairing controller instance.
- (void)bluetoothControllerReadyToScan:(ACKBluetoothPairingController *)bluetoothDeviceController;

/// Called when a supported ECG recording device (e.g., Kardia device) is discovered during scanning.
/// @param bluetoothDeviceController The Bluetooth pairing controller instance.
/// @param device The discovered device.
- (void)bluetoothDeviceController:(ACKBluetoothPairingController *)bluetoothDeviceController
        didDiscoverTriangleDevice:(ACKDevice *)device;

/// Called when a device is successfully paired.
/// @param bluetoothDeviceController The Bluetooth pairing controller instance.
- (void)bluetoothDeviceControllerPairingDidSucceed:(ACKBluetoothPairingController *)bluetoothDeviceController;

/// Called when no device could be found during the pairing process.
/// @param bluetoothDeviceController The Bluetooth pairing controller instance.
- (void)bluetoothDeviceControllerDeviceNotFound:(ACKBluetoothPairingController *)bluetoothDeviceController;

/// Called when an error occurs during the device pairing or connection process.
/// @param bluetoothDeviceController The Bluetooth pairing controller instance.
/// @param error The error that occurred.
- (void)bluetoothDeviceController:(ACKBluetoothPairingController *)bluetoothDeviceController
      didEncounterConnectionError:(ACKError *)error;

@optional
/// Called when an ECG recording device has been successfully connected.
/// @param device The connected device.
- (void)didPairDevice:(ACKDevice *)device;

/**
 * Asks the delegate whether connecting to a given device type is allowed.
 *
 * This is called before initiating connection or pairing when a device of the
 * specified type is discovered, and the SDK may adjust scan/pairing behavior
 * based on the answer.
 *
 * @param bluetoothDeviceController       The Bluetooth pairing controller requesting permission to connect.
 * @param deviceType           The device type the pairing controller is about to connect to.
 * @param configuredDeviceType The device type currently configured for this pairing controller.
 *
 * @return YES to allow connecting/scanning for the given device type; NO to
 *         prevent connection and keep the current pairing/scan behavior unchanged.
 */
- (BOOL)bluetoothDeviceController:(ACKBluetoothPairingController * _Nonnull)bluetoothDeviceController
        isAllowDiscoverDeviceType:(ACKDeviceType _Nonnull)deviceType
             configuredDeviceType:(ACKDeviceType _Nonnull)configuredDeviceType;

@end

/**
 * A controller that manages the Bluetooth pairing process for devices supported by the SDK.
 *
 * @discussion
 * `ACKBluetoothPairingController` encapsulates all logic required for pairing Bluetooth-based AliveCor devices, 
 * including retry handling and background/foreground transitions.
 *
 * Typically, Bluetooth pairing is managed automatically by `ACKEcgMonitorViewController`.
 * You should use this class and its delegate only if you need to implement a fully custom
 * Bluetooth pairing user experience.
 */
@interface ACKBluetoothPairingController : NSObject

/// The type of device being paired.
@property (nonatomic, nullable, copy, readonly) ACKDeviceType deviceType;

/// Unavailable. Use `initWithDeviceType:delegate:` instead.
- (instancetype)init NS_UNAVAILABLE;

/**
 * Creates and initializes a Bluetooth pairing controller for the specified device type.
 *
 * @param deviceType The type of device the user intends to pair.
 * @param delegate   The delegate that receives pairing state updates and events.
 * @return A configured instance of `ACKBluetoothPairingController`.
 */
- (instancetype)initWithDeviceType:(ACKDeviceType)deviceType
                          delegate:(id<ACKBluetoothPairingControllerDelegate>)delegate;

@end

NS_ASSUME_NONNULL_END
