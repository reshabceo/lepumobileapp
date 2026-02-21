//
//  ACKEcgRecord+Utils.h
//  AliveCorKitLite
//
//  Created by Rex Hsu on 10/19/20.
//  Copyright © 2020 AliveCor Inc. All rights reserved.
//

#if !KARDIACORE

#import <AliveCorKitLite/ACKEcgRecord.h>

NS_ASSUME_NONNULL_BEGIN

@class ACKError;

@interface ACKEcgRecord (Utils)

/// - Warning: AliveCor internal use only
///
/// @param samples a single channel of double-precision floats in millivolts.
/// @param sampleRate Sample rate used in samples.
+ (nullable ACKEcgRecord *)createEcgRecordFromMV:(NSData *)samples
                                      sampleRate:(double)sampleRate
                                  mainsFrequency:(ACKMainsFrequency)mainsFrequency
                                        duration:(NSNumber *)duration
                                      deviceData:(NSString *)deviceData
                                 softwareVersion:(NSString *)softwareVersion
                                recorderHardware:(NSString *)recorderHardware
                                    dateRecorded:(NSDate *)dateRecorded
                                  timezoneOffset:(NSNumber *)timezoneOffset
                                   recordingUUID:(NSString *)recordingUUID
                                      evaluation:(nullable ACKEcgEvaluation *)evaluation;

/// Creates an `ACKEcgRecord` instance.
///
/// **Note:** The `rawURL` and `enhancedURL` must share the same UUID. If they do not, the function will return an `ACKErrorCodeMismatchedUUID` error.
///
/// - Parameters:
///   - rawURL: URL of the raw ATC file.
///   - enhancedURL: URL of the enhanced ATC file.
///   - algorithmPackage: Used to determine whether to apply v1 or v2 algorithm.
///   - completion: Completion handler that returns an `ACKEcgRecord` if the input URLs are valid.

+ (void)createEcgRecordWithRawEcgURL:(NSURL *)rawURL
                      enhancedEcgURL:(NSURL *)enhancedURL
                    algorithmPackage:(NSString *)algorithmPackage
                          completion:(void (^)(ACKEcgRecord * _Nullable record, NSError * _Nullable error))completion;

@end

NS_ASSUME_NONNULL_END

#endif
