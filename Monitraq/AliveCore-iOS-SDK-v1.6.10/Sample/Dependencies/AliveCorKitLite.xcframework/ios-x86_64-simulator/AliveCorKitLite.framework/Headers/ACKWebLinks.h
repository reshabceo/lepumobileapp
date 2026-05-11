//
//  ACKWebLinks.h
//  AliveCorKitExample
//
//  Created by Alex Vlasenko on 4/25/20.
//  Copyright © 2020 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * A configuration class that defines customizable help links used across various HUD views.
 *
 * @discussion
 * `ACKWebLinks` provides a centralized way to override default web links shown in help
 * dialogs and error HUDs throughout the SDK. Each property corresponds to a specific
 * error or instruction context. If not customized, the default AliveCor help URLs are used.
 */
@interface ACKWebLinks : NSObject

/// Help link displayed when Bluetooth authorization fails.
/// Default: `https://www.alivecor.com/app-redirect/i-need-help-pairing-error-bt-not-authorized`
@property (nonatomic, copy, nullable) NSString *bluetoothNotAuthorized;

/// Help link displayed for generic Bluetooth connection errors.
/// Default: `https://www.alivecor.com/app-redirect/i-need-help-bluetooth-error`
@property (nonatomic, copy, nullable) NSString *bluetoothError;

/// Help link displayed when microphone access is denied.
/// Default: `https://www.alivecor.com/app-redirect/i-need-help-mic-error-ios`
@property (nonatomic, copy, nullable) NSString *microphoneAccess;

/// Help link displayed for Kardia Mobile single-lead recording instructions.
/// Default: `https://www.alivecor.com/app-redirect/i-need-help-recording-km`
@property (nonatomic, copy, nullable) NSString *kardiaMobileSingleLead;

/// Help link displayed for electrical interference errors.
/// Default: `https://www.alivecor.com/app-redirect/i-need-help-electrical-interference`
@property (nonatomic, copy, nullable) NSString *electricalInterference;

/// Help link displayed when an ECG recording is too short (between 10 and 30 seconds).
/// Default: `https://www.alivecor.com/app-redirect/i-need-help-too-short`
@property (nonatomic, copy, nullable) NSString *tooShort;

/// Help link displayed when the Triangle device's signal cannot be detected.
/// Default: `https://www.alivecor.com/app-redirect/i-need-help-pre-recording-error-device-not-found`
@property (nonatomic, copy, nullable) NSString *triangleNotFound;

/// Help link displayed when the device battery is critically low.
/// Default: `https://www.alivecor.com/app-redirect/i-need-help-battery-critical`
@property (nonatomic, copy, nullable) NSString *replaceBattery;

/// Help link displayed for six-lead (6L) recording instructions.
/// Default: `https://www.alivecor.com/app-redirect/i-need-help-recording-6l-six-lead`
@property (nonatomic, copy, nullable) NSString *triangleSixLead;

/// Help link displayed for single-lead recording instructions (6L device in single-lead mode).
/// Default: `https://www.alivecor.com/app-redirect/i-need-help-recording-6l-single-lead`
@property (nonatomic, copy, nullable) NSString *triangleSingleLead;

/// Help link displayed for unreadable ECG recordings due to excessive noise or artifacts.
/// Default: `https://www.alivecor.com/app-redirect/i-need-help-unreadable`
@property (nonatomic, copy, nullable) NSString *unreadable;

@end

NS_ASSUME_NONNULL_END
