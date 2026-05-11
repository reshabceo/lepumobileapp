//
//  ACKECGMonitorConfig.h
//  AliveECG
//
//  Created by Jim Qin on 7/5/17.
//  Copyright © 2017 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKTypes.h>
#import <AliveCorKitLite/ACKDevice.h>
#import <AliveCorKitLite/ACKStub.h>

NS_ASSUME_NONNULL_BEGIN

@class ACKError;

/**
 * Configuration that defines how the ECG recording flow looks and behaves.
 *
 * @discussion
 * Instances of this object encapsulate the input parameters that drive the ECG
 * monitor’s view logic and computed properties (e.g., duration limits, filter,
 * display options). Unspecified parameters use sensible defaults noted below.
 */
@interface ACKEcgRecordingConfig : NSObject

/// Device type used to record ECG.
@property (nonatomic, readonly) ACKDeviceType deviceType;

/// Recording lead configuration applied to the device.
@property (nonatomic, readonly) ACKLeadsConfig leadsConfig;

/// Filter setting for real-time ECG preview.
@property (nonatomic, readonly) ACKFilterType filterType;

/// Maximum recording duration (seconds) the monitor should allow.
@property (nonatomic, readonly) NSInteger maxDuration;

/**
 * Minimum recording duration (seconds).
 *
 * @discussion
 * If the recorded ECG is shorter than this value, the monitor resets its state
 * and the user must record again. Default is 10 seconds.
 */
@property (nonatomic, readonly) NSInteger minDuration;

/**
 * Power-line (mains) frequency used for filtering.
 *
 * @discussion
 * One of {ACKMainsFilter50Hz, ACKMainsFilter60Hz}. Stored as an integer; see
 * ACKMainsFrequency for symbolic values.
 */
@property (nonatomic, readonly) NSInteger frequency;

/**
 * Sampling rate of the ECG signal (Hz).
 *
 * @discussion
 * Stored as an integer; see ACKSampleRate for common values. Default is 300 Hz.
 */
@property (nonatomic, readonly) NSInteger sampleRate;

/**
 * Whether to hide the ECG trace during recording.
 *
 * @discussion
 * This flag is ignored for ACKDeviceTypeTriangle.
 */
@property (nonatomic) BOOL hideTrace;

/// Optional override for how the device name is presented to the user.
@property (nonatomic, copy) NSString *deviceDisplayName;

/// Whether the application should enable recording of audio notes.
@property (nonatomic) BOOL shouldCaptureAudio;

/// URL of an .mp4 instructions video to present to the user.
@property (nonatomic) NSURL *instructionsURL;

/// Localized instructions message to accompany the recording flow.
@property (nonatomic) NSString *instructionsMessage;

/**
 * Algorithm package used for ECG evaluation.
 *
 * @discussion
 * Specify "kaiv2" to request Kardia AI v2 when eligible; falls back to AI v1
 * if v2 is not available for the SDK.
 */
@property (nonatomic, readonly) NSString *algorithmPackage;

/// Whether BPM should be displayed during recording.
@property (nonatomic, readonly) BOOL displayBpmDuringRecording;

#pragma mark - Initializers

/**
 * Create a configuration for the ECG monitor.
 *
 * @param deviceType  Hardware device used for recording.
 * @param leadsConfig Recording lead configuration.
 * @param filterType  Real-time preview filter.
 * @param maxDuration Maximum duration (seconds). Default if not specified: 30.
 * @param frequency   Mains frequency; one of {ACKMainsFilter50Hz, ACKMainsFilter60Hz}.
 *                    Default if not specified: ACKMainsFrequency60Hz.
 * @param sampleRate  Sampling rate (Hz). Default if not specified: 300.
 * @param minDuration Minimum duration (seconds). Default: 10. If the ECG is
 *                    shorter than this value, the monitor resets.
 * @param algorithmPackage "kaiv2" to request Kardia AI v2 when eligible; falls
 *                         back to AI v1 otherwise.
 * @param displayBpmDuringRecording Whether BPM is shown on the recording screen.
 * @param error       Populated if initialization fails (e.g., invalid options or API key).
 *
 * @return A configured instance, or nil on failure.
 */
- (nullable instancetype)initWithDeviceType:(ACKDeviceType)deviceType
                                leadsConfig:(ACKLeadsConfig)leadsConfig
                                 filterType:(ACKFilterType)filterType
                                maxDuration:(NSInteger)maxDuration
                                  frequency:(NSInteger)frequency
                                 sampleRate:(NSInteger)sampleRate
                                minDuration:(NSInteger)minDuration
                           algorithmPackage:(NSString *)algorithmPackage
                  displayBpmDuringRecording:(BOOL)displayBpmDuringRecording
                                      error:(ACKError *_Nullable *_Nullable)error;

/**
 * Create a configuration for the ECG monitor.
 *
 * @param deviceType  Hardware device used for recording.
 * @param leadsConfig Recording lead configuration.
 * @param filterType  Real-time preview filter.
 * @param maxDuration Maximum duration (seconds). Default if not specified: 30.
 * @param frequency   Mains frequency; one of {ACKMainsFilter50Hz, ACKMainsFilter60Hz}.
 *                    Default if not specified: ACKMainsFrequency60Hz.
 * @param sampleRate  Sampling rate (Hz). Default if not specified: 300.
 * @param minDuration Minimum duration (seconds). Default: 10.
 * @param algorithmPackage "kaiv2" to request Kardia AI v2 when eligible; falls
 *                         back to AI v1 otherwise.
 * @param error       Populated if initialization fails (e.g., invalid options or API key).
 *
 * @return A configured instance, or nil on failure.
 */
- (nullable instancetype)initWithDeviceType:(ACKDeviceType)deviceType
                                leadsConfig:(ACKLeadsConfig)leadsConfig
                                 filterType:(ACKFilterType)filterType
                                maxDuration:(NSInteger)maxDuration
                                  frequency:(NSInteger)frequency
                                 sampleRate:(NSInteger)sampleRate
                                minDuration:(NSInteger)minDuration
                           algorithmPackage:(NSString *)algorithmPackage
                                      error:(ACKError *_Nullable *_Nullable)error;

/**
 * Create a configuration for the ECG monitor.
 *
 * @param deviceType  Hardware device used for recording.
 * @param leadsConfig Recording lead configuration.
 * @param filterType  Real-time preview filter.
 * @param maxDuration Maximum duration (seconds). Default if not specified: 30.
 * @param frequency   Mains frequency; one of {ACKMainsFilter50Hz, ACKMainsFilter60Hz}.
 *                    Default if not specified: ACKMainsFrequency60Hz.
 * @param algorithmPackage "kaiv2" to request Kardia AI v2 when eligible; falls
 *                         back to AI v1 otherwise.
 * @param error       Populated if initialization fails (e.g., invalid options or API key).
 *
 * @return A configured instance, or nil on failure.
 */
- (nullable instancetype)initWithDeviceType:(ACKDeviceType)deviceType
                                leadsConfig:(ACKLeadsConfig)leadsConfig
                                 filterType:(ACKFilterType)filterType
                                maxDuration:(NSInteger)maxDuration
                                  frequency:(NSInteger)frequency
                           algorithmPackage:(NSString *)algorithmPackage
                                      error:(ACKError *_Nullable *_Nullable)error;

/**
 * Create a configuration for the ECG monitor.
 *
 * @param deviceType  Hardware device used for recording.
 * @param leadsConfig Recording lead configuration.
 * @param filterType  Real-time preview filter.
 * @param maxDuration Maximum duration (seconds). Default if not specified: 30.
 * @param algorithmPackage "kaiv2" to request Kardia AI v2 when eligible; falls
 *                         back to AI v1 otherwise.
 * @param error       Populated if initialization fails (e.g., invalid options or API key).
 *
 * @return A configured instance, or nil on failure.
 */
- (nullable instancetype)initWithDeviceType:(ACKDeviceType)deviceType
                                leadsConfig:(ACKLeadsConfig)leadsConfig
                                 filterType:(ACKFilterType)filterType
                                maxDuration:(NSInteger)maxDuration
                           algorithmPackage:(NSString *)algorithmPackage
                                      error:(ACKError *_Nullable *_Nullable)error;

/**
 * Create a configuration for the ECG monitor.
 *
 * @param deviceType  Hardware device used for recording.
 * @param leadsConfig Recording lead configuration.
 * @param filterType  Real-time preview filter.
 * @param algorithmPackage "kaiv2" to request Kardia AI v2 when eligible; falls
 *                         back to AI v1 otherwise.
 * @param error       Populated if initialization fails (e.g., invalid options or API key).
 *
 * @return A configured instance, or nil on failure.
 */
- (nullable instancetype)initWithDeviceType:(ACKDeviceType)deviceType
                                leadsConfig:(ACKLeadsConfig)leadsConfig
                                 filterType:(ACKFilterType)filterType
                           algorithmPackage:(NSString *)algorithmPackage
                                      error:(ACKError *_Nullable*_Nullable)error;

/**
 * Create a configuration for the ECG monitor with minimal inputs.
 *
 * @param deviceType  Hardware device used for recording.
 * @param algorithmPackage "kaiv2" to request Kardia AI v2 when eligible; falls
 *                         back to AI v1 otherwise.
 * @param error       Populated if initialization fails (e.g., invalid options or API key).
 *
 * @return A configured instance, or nil on failure.
 */
- (nullable instancetype)initWithDeviceType:(ACKDeviceType)deviceType
                           algorithmPackage:(NSString *)algorithmPackage
                                      error:(ACKError *_Nullable *_Nullable)error;

- (instancetype)init NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END
