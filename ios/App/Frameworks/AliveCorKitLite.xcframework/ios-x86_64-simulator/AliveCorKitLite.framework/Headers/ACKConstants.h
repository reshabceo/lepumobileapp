//
//  ACKBluetoothECGMode.h
//  AliveCorKitExample
//
//  Created by Ishan Vijay Alone on 07/07/25.
//  Copyright © 2025 AliveCor. All rights reserved.
//

#ifndef ACKBluetoothECGMode_h
#define ACKBluetoothECGMode_h

typedef NS_ENUM(NSInteger, ACKBluetoothECGMode) {
    ACKBluetoothECGModeUnknown = 0,
    ACKBluetoothECGModeSingleLead300Hz,  // 1 channel, 300Hz sample rate, 0.5-40Hz bandwidth
    ACKBluetoothECGModeDualLead300Hz,    // 2 channels, 300Hz sample rate, 0.5-40Hz bandwidth
    ACKBluetoothECGModeSingleLead600Hz,  // 1 channel, 600Hz sample rate, 0.05-150Hz bandwidth
    ACKBluetoothECGModeDualLead600Hz,    // 2 channels, 600Hz sample rate, 0.05-150Hz bandwidth
};

typedef NS_ENUM(NSInteger, ACKBluetoothDeviceConnectionError) {
    // An unhandled error occurred due to a transient issue. The user should call
    // disconnect() on bluetoothDeviceController before retrying.
    ACKBluetoothDeviceConnectionErrorUnexpected,
    // Bluetooth is not supported.
    ACKBluetoothDeviceConnectionErrorBluetoothUnsupported,
    // Bluetooth is disabled.
    ACKBluetoothDeviceConnectionErrorBluetoothOff,
    // The user denied the pairing request..
    ACKBluetoothDeviceConnectionErrorPairingRequestDenied,
    // Device disconnected from a cause other than an explicit disconnect call.
    ACKBluetoothDeviceConnectionErrorDisconnected,
};

typedef NS_ENUM(NSUInteger, ACKRecordingState) {
    ACKRecordingStateMaxDuration = 0,
    ACKRecordingStateLeadsOff,
    ACKRecordingStateMainsNoise
};

typedef NS_ENUM(NSUInteger, ACKLeadState) {
    ACKLeadStateOff = 0,
    ACKLeadStateInitializing,
    ACKLeadStateOn
};

typedef struct {
    NSInteger leadI;
    NSInteger leadII;
    NSInteger leadIII;
    NSInteger aVR;
    NSInteger aVL;
    NSInteger aVF;
} ACKLeadValues;

#endif
