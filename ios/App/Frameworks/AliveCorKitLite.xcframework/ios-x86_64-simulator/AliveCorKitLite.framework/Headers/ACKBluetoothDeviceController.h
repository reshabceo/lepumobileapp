//
//  ACKBluetoothDeviceController.h
//  AliveCorKitExample
//
//  Created by Ishan Vijay Alone on 04/07/25.
//  Copyright © 2025 AliveCor. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKConstants.h>


NS_ASSUME_NONNULL_BEGIN
@class ACKBLEDevice;
@protocol BLEDeviceDelegateHandler;

@protocol BluetoothDelegateHandler <NSObject>
- (void)onStopScanningWithTimeout:(BOOL)timeout;
- (void)onReadyToScan;
- (void)onConnectWithBleDevice:(ACKBLEDevice *)bleDevice;
- (void)onDisconnectWithBleDevice:(ACKBLEDevice *)bleDevice;
- (void)onDiscoverWithBleDevice:(ACKBLEDevice *)bleDevice;
- (void)onConnectionWithError:(ACKBluetoothDeviceConnectionError)error internalError:(NSError * _Nullable)internalError;
- (void)onBeginConnecting;
@end

extern NSString *ACBluetoothErrorDomain;

@interface ACKBluetoothDeviceController : NSObject

- (instancetype)initWithConnectionHandler:(nullable id<BluetoothDelegateHandler>)bluetoothConnectionhandler andBLEDeviceDelegateHandler:(nullable id<BLEDeviceDelegateHandler>)bleDevicehandler NS_DESIGNATED_INITIALIZER;

- (instancetype)init NS_DESIGNATED_INITIALIZER;

/**
 * Start scanning.
 */
- (void)startScanning;

/**
 * Stop scanning.  If we are currently connected, the device will be disconnected.
 */
- (void)stopScanning;

/**
 * Ends the connection to the currently connecting or connected peripheral.
 */
- (void)disconnectBLEDevice:(ACKBLEDevice *)device;

/**
 * Connect to a bluetooth device.
 *
 * @param device The device to connect to.
 */
- (void)connectBLEDevice:(ACKBLEDevice *)device;

@end

NS_ASSUME_NONNULL_END
