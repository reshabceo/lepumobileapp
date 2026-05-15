//
//  NSFileManager+ACEcgMonitor.h
//  ACEcgMonitor
//
//  Created by Ned Fox on 7/25/14.
//  Copyright (c) 2014 AliveCor, Inc. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NSFileManager (ACEcgMonitor)

+ (nullable NSString *)documentsDirectory;
+ (nullable NSString *)ecgFileDirectory;
+ (NSString *)ecgBasePath;
+ (NSString *)atcFileNameForRecordingId:(NSString *)recordingId filterSpecifier:(nullable NSString *)filterSpecifier;
+ (nullable NSString *)atcFilePathForRecordingId:(NSString *)recordingId filterSpecifier:(nullable NSString *)filterSpecifier;
+ (void)deleteOriginalAtcFilePath:(NSString *)atcFilePath enhancedAtcFilePath:(NSString *)enhancedAtcFilePath m4aAudioFilePath:(NSString *)m4aAudioFilePath;
+ (BOOL)isEnoughSpaceToRecordEKG:(long long *)availableSpaceInBytes forRecordingDuration:(NSUInteger)recordingDuration;

@end

NS_ASSUME_NONNULL_END
