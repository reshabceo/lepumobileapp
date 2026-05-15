//
//  ACKStreamingFilter.h
//  AliveCorKitLite
//
//  Created by Oleksandr Vlasenko on 5/18/21.
//  Copyright © 2021 Alex Vlasenko. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKTypes.h>

NS_ASSUME_NONNULL_BEGIN

@class ACKError;

/**
 * A utility class for applying real-time digital filters to ECG samples.
 *
 * @discussion
 * `ACKStreamingFilter` provides real-time filtering of raw ECG signal samples
 * using one of the supported AliveCor filter types.
 *
 * This class is designed for cases where the app has access to raw ECG data
 * (e.g., from a live data stream or stored file).
 * It does **not** provide access to the same filtered data displayed
 * on the standard ECG recording screen (`ACKEcgMonitorViewController`).
 *
 * ### Typical usage:
 * 1. Establish access to a raw ECG data source (file, stream, etc.).
 * 2. Create an instance of `ACKStreamingFilter` with the desired configuration.
 * 3. Pass each incoming sample through `filterSample:` to obtain a filtered output.
 */
@interface ACKStreamingFilter : NSObject

/**
 * Creates an instance of `ACKStreamingFilter` with the specified configuration.
 *
 * @param filterType The filter type to apply to the ECG signal.
 * @param sampleRate The sampling frequency of the ECG signal.
 * @param mainsFrequency The power-line frequency where the ECG was recorded (`ACKMainsFrequency50Hz` or `ACKMainsFrequency60Hz`).
 * @param error If an error occurs during initialization, this parameter is set to an `ACKError` object describing the issue.
 *
 * @return A new instance of `ACKStreamingFilter`, or `nil` if initialization fails.
 */
- (nullable instancetype)initWithFilterType:(ACKFilterType)filterType
                                 sampleRate:(ACKSampleRate)sampleRate
                             mainsFrequency:(ACKMainsFrequency)mainsFrequency
                                      error:(ACKError * _Nullable *_Nullable)error;

/**
 * Filters a single ECG sample using the configured filter.
 *
 * @param sample The raw ECG sample value (in millivolts).
 * @return The filtered ECG sample.
 */
- (double)filterSample:(double)sample;

@end

NS_ASSUME_NONNULL_END
