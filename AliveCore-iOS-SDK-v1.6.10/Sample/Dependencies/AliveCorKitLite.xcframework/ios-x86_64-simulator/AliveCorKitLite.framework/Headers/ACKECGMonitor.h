//
//  ACKECGMonitor.h
//  AliveCorKitExample
//
//  Created by Ishan Vijay Alone on 07/07/25.
//  Copyright © 2025 AliveCor. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKConstants.h>

typedef NS_ENUM(NSUInteger, ACKFilter) {
    ACKFilterNone = 0,   // No filter, display the raw ECG samples.
    ACKFilterMainsOnly,  // Filter out mains-frequency noise.
    ACKFilterNotch,      // Notch mains filter.
    ACKFilterOriginal,   // Baseline wander correction plus mains filter.
    ACKFilterEnhanced    // Apply enhanced filter.
};


@class ACKBLEDevice;
@class ACKKardiaMobileDevice;
@class ACLeadValuesObject;

@protocol MonitorDelegateHandler <NSObject>
- (void)monitorRecordingStarted;
- (void)monitorRecordingCompleteWithRecordingState:(ACKRecordingState)recordingState
                                          inverted:(BOOL)inverted
                                           ecgPath:(NSString * _Nullable)ecgPath
                                    filteredEcgPath:(NSString * _Nullable)filteredEcgPath
                                          audioPath:(NSString * _Nullable)audioPath;

- (void)monitorRecordingFailedWithError:(NSError *_Nonnull)error;
- (void)monitorRecordingProgress:(NSInteger)recordedMS;
- (void)monitorLeadsStateUpdatedWithLead1State:(ACKLeadState)lead1State
                                   lead2State:(ACKLeadState)lead2State;
- (void)monitorMainsNoiseStarted;
- (void)monitorMainsNoiseStopped;
- (void)monitorStartPreview;
- (void)monitorPreview:(ACLeadValuesObject * _Nonnull)leadValues;

- (void)monitorBeatDetectedWithHeartRate:(NSInteger)heartRate
                             delaySamples:(NSInteger)delaySamples;
- (void)monitorSignalStrengthUpdatedWithSignalPercent:(NSInteger)signalPercent
                                                 rssi:(float)rssi;
- (void)monitorStopPreview;

@end
NS_ASSUME_NONNULL_BEGIN

@interface ACKECGMonitor : NSObject
- (instancetype)init NS_UNAVAILABLE;
/**
 * Designated initializer.
 *
 * @param device The device to record from.
 * @param basePath A directory where ECG and Audio recordings can be saved.
 * @param phoneUUID The UUID of the device used to make the recording (Unused).
 * @param phoneModel The model of the device used to make the recording.
 * @param softwareVersion The version of the recording software.
 * @param mainsFrequencyHz The mains frequency (Hz).  50 or 60.
 * @param previewFilter The filter to apply to realtime preview.  Has no effect on the recording file.
 * @param minDurationMS Min duration to save a recording (ms).
 * @param maxDurationMS Max duration to automatically end recording (ms).
 * @param handler An object that implements MonitorDelegateHandler.
 */
- (instancetype)initWithBLEDevice:(ACKBLEDevice *)device
                      basePath:(NSString *)basePath
                     phoneUUID:(NSString *)phoneUUID
                    phoneModel:(NSString *)phoneModel
               softwareVersion:(NSString *)softwareVersion
                mainsFrequency:(int)mainsFrequencyHz
                 previewFilter:(ACKFilter)previewFilter
                   minDuration:(int)minDurationMS
                   maxDuration:(int)maxDurationMS
               delegateHandler:(nullable id<MonitorDelegateHandler>)handler;


- (instancetype)initWithKardiMobileDevice:(ACKKardiaMobileDevice *)device
                      basePath:(NSString *)basePath
                     phoneUUID:(NSString *)phoneUUID
                    phoneModel:(NSString *)phoneModel
               softwareVersion:(NSString *)softwareVersion
                mainsFrequency:(int)mainsFrequencyHz
                 previewFilter:(ACKFilter)previewFilter
                   minDuration:(int)minDurationMS
                   maxDuration:(int)maxDurationMS
                          delegateHandler:(nullable id<MonitorDelegateHandler>)handler;

/**
 * Update the recorder hardware field which will be saved in the ATC.
 */
- (void)setRecorderHardware:(NSString *)recorderHardware;

/**
 * Update the device data field which will be saved in the ATC.
 */
- (void)setDeviceData:(NSString *)deviceData;

/**
 * Start monitoring.
 */
- (void)start;

/**
 * Stop monitoring.
 */
- (void)stop;

/**
 * Invert a completed recording.
 */
- (void)invertRecording;
@end

NS_ASSUME_NONNULL_END
