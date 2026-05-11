//
//  ECGRecord.h
//  ACKit
//
//  Created by Alex Vlasenko on 10/18/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKTypes.h>

NS_ASSUME_NONNULL_BEGIN
@class ACKDevice;
@class ACKEcgEvaluation;
@class ACKEcgRecordingConfig;

/**
 * Represents a captured ECG recording and its associated context.
 *
 * @discussion
 * `ACKEcgRecord` is produced by `ACKEcgMonitorViewController` and serves as the
 * primary data model for SDK UI components. It bundles the raw/enhanced ECG file
 * paths, the recording configuration, device metadata, timing information, and
 * any Kardia AI evaluation results.
 */
@interface ACKEcgRecord : NSObject

/// Unique identifier for the ECG recording.
@property (nonatomic, copy, readonly, nullable) NSString *uuid;

/// Path to the raw ATC recording file (baseline-corrected and mains-filtered).
@property (nonatomic, copy, readonly, nullable) NSString *originalPath;

/// Path to the enhanced-filtered ATC recording file.
@property (nonatomic, copy, readonly, nullable) NSString *enhancedPath;

/// Path to the audio-notes file (M4A format), if captured.
@property (nonatomic, copy, readonly, nullable) NSString *audioNotesPath;

/// Measurement date/time of the recording. Not required to render the ECG trace.
@property (nonatomic, copy, readonly, nullable) NSDate *recordedAt;

/// Time-zone offset for the measurement (relative to UTC).
/// Not required to render the ECG trace.
@property (nonatomic, readonly) NSNumber *timeZoneOffset;

/// Directory containing the ECG recording files.
@property (nonatomic, copy, readonly) NSString *filesDirectory;

/// Recording duration in milliseconds.
@property (nonatomic, copy, readonly, nullable) NSNumber *duration;

/// Device used to capture the ECG.
@property (nonatomic, copy, readonly, nullable) ACKDevice *device;

/// Configuration applied during the recording.
@property (nonatomic, copy, readonly) ACKEcgRecordingConfig *config;

/// Kardia AI evaluation results for the recording, if available.
@property (nonatomic, copy, readonly, nullable) ACKEcgEvaluation *evaluation;

/// Placeholder for partner-specific metadata.
@property (nonatomic, copy, nullable) NSDictionary *metadata;

#pragma mark - Designated / Convenience Initializers

/**
 * Initializes a record with full context and optional evaluation.
 *
 * @param uuid            Unique identifier for the ECG recording.
 * @param duration        Recording duration.
 * @param config          Configuration used to record the ECG.
 * @param device          Device used to record the ECG.
 * @param recordedAt      Measurement date/time.
 * @param timeZoneOffset  Time-zone offset relative to UTC.
 * @param evaluation      Kardia AI evaluation for this recording.
 *
 * @return A new `ACKEcgRecord` instance.
 */
- (instancetype)initWithUUID:(NSString * _Nullable)uuid duration:(NSNumber * _Nullable)duration config:(ACKEcgRecordingConfig *)config device:(ACKDevice * _Nullable)device recordedAt:(NSDate * _Nullable)recordedAt timeZoneOffset:(NSNumber * _Nullable)timeZoneOffset evaluation:(ACKEcgEvaluation * _Nullable)evaluation;

/**
 * Initializes a record with timing and configuration (no evaluation).
 *
 * @param uuid            Unique identifier for the ECG recording.
 * @param duration        Recording duration.
 * @param config          Configuration used to record the ECG.
 * @param device          Device used to record the ECG.
 * @param recordedAt      Measurement date/time.
 * @param timeZoneOffset  Time-zone offset relative to UTC.
 *
 * @return A new `ACKEcgRecord` instance.
 */
- (instancetype)initWithUUID:(NSString * _Nullable)uuid duration:(NSNumber * _Nullable)duration config:(ACKEcgRecordingConfig *)config device:(ACKDevice * _Nullable)device recordedAt:(NSDate * _Nullable)recordedAt timeZoneOffset:(NSNumber * _Nullable)timeZoneOffset;

/**
 * Creates a lightweight record for displaying ECG content using a single ATC path.
 * Suitable for `ACKEcgFileView`, `ACKScrollView`, and `ACKRecordingResultTraceView`.
 *
 * @param uuid         Unique identifier for the ECG recording.
 * @param ecgPath      Path to the ECG ATC file.
 * @param deviceType   Device type used to record the ECG.
 * @param filterType   Filter applied for rendering.
 * @param leadsConfig  Leads configuration used for the recording.
 * @param evaluation   Optional Kardia AI evaluation.
 * @param recordedAt   Optional measurement date/time.
 *
 * @return A new `ACKEcgRecord` instance.
 */
- (instancetype)initWithUUID:(NSString *)uuid
                     ecgPath:(NSString *)ecgPath
                  deviceType:(ACKDeviceType)deviceType
                  filterType:(ACKFilterType)filterType
                 leadsConfig:(ACKLeadsConfig)leadsConfig
                  evaluation:(ACKEcgEvaluation * _Nullable)evaluation
                  recordedAt:(NSDate * _Nullable)recordedAt;

/**
 * Creates a lightweight record (no UUID parameter) for displaying ECG content.
 * Suitable for `ACKEcgFileView`, `ACKScrollView`, and `ACKRecordingResultTraceView`.
 *
 * @param ecgPath      Path to the ECG ATC file.
 * @param deviceType   Device type used to record the ECG.
 * @param filterType   Filter applied for rendering.
 * @param leadsConfig  Leads configuration used for the recording.
 * @param evaluation   Optional Kardia AI evaluation.
 *
 * @return A new `ACKEcgRecord` instance.
 */
- (instancetype)initWithEcgPath:(NSString *)ecgPath
                     deviceType:(ACKDeviceType)deviceType
                     filterType:(ACKFilterType)filterType
                    leadsConfig:(ACKLeadsConfig)leadsConfig
                     evaluation:(ACKEcgEvaluation * _Nullable)evaluation;

/**
 * Creates a lightweight record with both raw and enhanced ATC paths.
 *
 * @param uuid          Unique identifier for the ECG recording.
 * @param ecgPath       Path to the raw/baseline-corrected ATC file.
 * @param enhancedPath  Path to the enhanced-filtered ATC file.
 * @param deviceType    Device type used to record the ECG.
 * @param filterType    Filter applied for rendering.
 * @param leadsConfig   Leads configuration used for the recording.
 * @param evaluation    Optional Kardia AI evaluation.
 * @param duration      Recording duration.
 * @param recordedAt    Optional measurement date/time.
 *
 * @return A new `ACKEcgRecord` instance.
 */
- (instancetype)initWithUUID:(NSString *)uuid
                     ecgPath:(NSString *)ecgPath
             enhancedEcgPath:(NSString *)enhancedPath
                  deviceType:(ACKDeviceType)deviceType
                  filterType:(ACKFilterType)filterType
                 leadsConfig:(ACKLeadsConfig)leadsConfig
                  evaluation:(ACKEcgEvaluation * _Nullable)evaluation
                    duration:(NSNumber *)duration
                  recordedAt:(NSDate * _Nullable)recordedAt;

- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;
@end

NS_ASSUME_NONNULL_END
