//
//  ACKKardiaAI.h
//  AliveCorKitExample
//
//  Created by Alex Vlasenko on 1/8/20.
//  Copyright © 2020 AliveCor, Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKTypes.h>
#import <AliveCorKitLite/ACKEcgEvaluation.h>
#import <AliveCorKitLite/ACKError.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Provides ECG evaluation functionality using Kardia AI.
 *
 * @discussion
 * This class offers APIs for analyzing ECG recordings using Kardia AI.
 * Input samples can be provided either as double-precision millivolt values
 * or as 16-bit signed integers. The data is copied into internal storage
 * during evaluation.
 */
@interface ACKKardiaAI : NSObject

/**
 * Creates a new instance of Kardia AI evaluator.
 *
 * @param error Optional pointer to an ACKError object that will contain
 *              initialization error information if the creation fails.
 *
 * @return A new ACKKardiaAI instance, or nil if initialization fails.
 */
+ (instancetype)initWithError:(ACKError * _Nullable *_Nullable)error;

/**
 * Evaluates an ECG signal using an array of double-precision millivolt samples.
 *
 * @param samplesMV        Pointer to an array of ECG samples in millivolts.
 *                         The data will be copied into internal storage.
 * @param length           Number of samples in the array.
 * @param sampleRate       Sampling rate of the ECG signal.
 * @param frequency        Power line frequency at which the ECG was recorded.
 *                         One of {ACKMainsFilter50Hz, ACKMainsFilter60Hz}.
 * @param algorithmPackage Specify `"kaiv2"` to enable Kardia AI v2 if supported.
 *                         If v2 is unavailable, the SDK automatically falls
 *                         back to AI v1.
 *
 * @return An `ACKEcgEvaluation` object containing the analysis results.
 */
- (ACKEcgEvaluation *)evaluateMVSamples:(const double *)samplesMV
                                 length:(NSUInteger)length
                             sampleRate:(ACKSampleRate)sampleRate
                              frequency:(ACKMainsFrequency)frequency
                       algorithmPackage:(NSString *)algorithmPackage;

/**
 * Evaluates an ECG signal using an array of 16-bit signed integer samples.
 *
 * @param samplesATC       Pointer to an array of 16-bit signed ECG samples.
 *                         The data will be copied into internal storage.
 * @param length           Number of samples in the array.
 * @param sampleRate       Sampling rate of the ECG signal.
 * @param frequency        Power line frequency at which the ECG was recorded.
 *                         One of {ACKMainsFilter50Hz, ACKMainsFilter60Hz}.
 * @param algorithmPackage Specify `"kaiv2"` to enable Kardia AI v2 if supported.
 *                         If v2 is unavailable, the SDK automatically falls
 *                         back to AI v1.
 *
 * @return An `ACKEcgEvaluation` object containing the analysis results.
 */
- (ACKEcgEvaluation *)evaluateATCSamples:(const short *)samplesATC
                                  length:(NSUInteger)length
                              sampleRate:(ACKSampleRate)sampleRate
                               frequency:(ACKMainsFrequency)frequency
                        algorithmPackage:(NSString *)algorithmPackage;

- (instancetype)init NS_UNAVAILABLE;
@end

NS_ASSUME_NONNULL_END
