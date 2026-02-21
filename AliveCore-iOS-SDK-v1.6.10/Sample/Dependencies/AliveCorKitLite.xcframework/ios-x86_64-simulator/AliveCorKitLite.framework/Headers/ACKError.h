//
//  ACKError.h
//  ACKit
//
//  Created by Alex Vlasenko on 10/30/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>

/**
 * Error codes describing failures encountered while recording or evaluating an ECG.
 */
typedef NS_ENUM(NSInteger, ACKErrorCode) {
    /// Reserved default state.
    ACKErrorCodeNone,

    /// An unknown error occurred.
    ACKErrorCodeUnknown,

    /// The provided leads configuration is invalid.
    ACKErrorCodeInvalidLeadsConfig,

    /// The provided ECG recording configuration is invalid.
    ACKErrorCodeInvalidRecordingConfig,

    /// The authorization token is invalid.
    /// @note Will be renamed to `ACKErrorCodeInvalidAuthorizationToken` in the future releases.
    ACKErrorCodeInvalidToken,

    /// The specified device type is not supported.
    ACKErrorCodeDeviceTypeNotSupported,

    /// Bluetooth is turned off. (Triangle and Kardia Card only.)
    ACKErrorCodeBluetoothOff,

    /// Bluetooth is not supported on this device. (Triangle and Kardia Card only.)
    ACKErrorCodeBluetoothUnsupported,

    /// The Bluetooth device disconnected. (Triangle and Kardia Card only.)
    ACKErrorCodeBluetoothDisconnected,

    /// The Bluetooth pairing request was denied. (Triangle and Kardia Card only.)
    ACKErrorCodeBluetoothPairingRequestDenied,

    /// Microphone permission is required to record an EKG.
    ACKErrorCodeMicPermissionEKG,

    /// The Bluetooth device battery level is too low to record. (Triangle and Kardia Card only.)
    /// @note Will be renamed to `ACKErrorCodeBluetoothDeviceBattery` in the future releases.
    ACKErrorCodeTriangleBattery,

    /// Connection to the Triangle device failed. (Triangle only.)
    ACKErrorCodeTriangleConnection,

    /// Excessive mains noise and the recording is too short to save.
    ACKErrorCodeMainsNoiseEarly,

    /// The Kardia AI evaluation returned invalid output.
    ACKErrorCodeEvaluationInvalidOutput,

    /// Recording completed, but duration is too short for Kardia AI evaluation.
    ACKErrorCodeEvaluationTooShort,

    /// Recording completed, but Kardia AI could not evaluate the ECG.
    ACKErrorCodeEvaluationUnreadable,

    /// Recording completed, but the ECG is too short or unreadable (electrical interference).
    ACKErrorCodeElectricallyInterfered,

    /// Not enough disk space to record an ECG.
    ACKErrorCodeNotEnoughStorage,

    /// Audio session error while using KardiaMobile (connection or runtime failure).
    ACKErrorCodeAudioSession,

    /// Insufficient audio session priority for KardiaMobile.
    ACKErrorCodeAudioInsufficientPriority,

    /// Device registration failed.
    ACKErrorCodeDeviceRegistration,

    /// Device is registered, but ECG recordings are not allowed.
    ACKErrorCodeDeviceDisabled,

    /// SDK configuration has not been refreshed within the required time window; re-authentication is needed.
    ACKErrorCodeStaleSDKConfiguration,

    /// Device plan has not been refreshed within the required time window; re-authentication is needed.
    ACKErrorCodeStaleDevicePlan,

    /// SDK configuration is invalid or missing required values.
    ACKErrorCodeInvalidConfiguration,

    /// Provided SDK API key is invalid or does not match.
    ACKErrorCodeInvalidApiKey,

    /// UUIDs of the original and enhanced ATC files do not match.
    ACKErrorCodeMismatchedUUID,

    /// ATC file could not be found.
    ACKErrorCodeAtcNotFound,

    /// Saved/passed device name does not match the detected device name.
    ACKErrorCodeDeviceNameMismatch,
};

NS_ASSUME_NONNULL_BEGIN

typedef NSString * ACKErrorDomain NS_STRING_ENUM;

/// Error domain for PDF generation errors.
extern ACKErrorDomain const ACKErrorDomainPdf;

/**
 * Error codes for failures encountered while creating a PDF report.
 */
typedef NS_ENUM(NSInteger, ACKPDFErrorCode) {
    /// The ECG path was not found in the associated `ACKEcgRecord`.
    ACKPDFErrorCodeEcgPathNotFound,

    /// An ECG recording is required to generate the PDF.
    ACKPDFErrorCodeEcgMissing,

    /// A mandatory configuration property is missing.
    ACKPDFErrorCodeConfiguration,

    /// The ECG file could not be opened.
    ACKPDFErrorCodeFileOpen,

    /// The ECG file contains no samples.
    ACKPDFErrorCodeEmptySamples,
};

/**
 * Represents an SDK error with optional localized title, message, and help link.
 */
@interface ACKError : NSError

/// Localized, user-visible error title.
@property (nonatomic, readonly, getter=getLocalizedTitle) NSString *localizedTitle;

/// Localized, user-visible error message/details.
@property (nonatomic, readonly, getter=getLocalizedMessage) NSString *localizedMessage;

/// Optional help/documentation link associated with this error.
@property (nonatomic, readonly, getter=getLink) NSString *link;

+ (instancetype)errorWithCode:(ACKErrorCode)code;
+ (instancetype)errorWithCode:(ACKErrorCode)code title:(nullable NSString *)title;
+ (instancetype)errorWithCode:(ACKErrorCode)code title:(nullable NSString *)title message:(nullable NSString *)message;
+ (instancetype)errorWithCode:(ACKErrorCode)code title:(nullable NSString *)title message:(nullable NSString *)message userInfo:(NSDictionary *)userInfo;
+ (instancetype)errorWithCode:(ACKErrorCode)code title:(nullable NSString *)title message:(nullable NSString *)message link:(nullable NSString *)link;

- (instancetype)initWithCode:(ACKErrorCode)code;
- (instancetype)initWithCode:(ACKErrorCode)code title:(nullable NSString *)title;
- (instancetype)initWithCode:(ACKErrorCode)code title:(nullable NSString *)title message:(nullable NSString *)message;
- (instancetype)initWithCode:(ACKErrorCode)code title:(nullable NSString *)title message:(nullable NSString *)message link:(nullable NSString *)link;
- (instancetype)initWithCode:(ACKErrorCode)code title:(nullable NSString *)title message:(nullable NSString *)message userInfo:(NSDictionary *)userInfo;

/// Designated initializer for custom error domains (e.g., `ACKErrorDomainPdf`).
- (instancetype)initWithDomain:(ACKErrorDomain)domain code:(NSInteger)code title:(nullable NSString *)title message:(nullable NSString *)message link:(nullable NSString *)link;

@end

NS_ASSUME_NONNULL_END
