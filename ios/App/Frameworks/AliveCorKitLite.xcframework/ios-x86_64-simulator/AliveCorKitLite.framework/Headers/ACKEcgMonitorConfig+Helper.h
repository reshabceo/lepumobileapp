//
//  ACKEcgMonitorConfig+Private.h
//  AliveCorKit
//
//  Created by Alex Vlasenko on 12/13/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import "ACKEcgRecordingConfig.h"

NS_ASSUME_NONNULL_BEGIN

@interface ACKEcgRecordingConfig (Helper)

/**
For Triangle source devices only, whether the device is in single or dual lead mode
dervied from the recording source options. Asserts if this property is read and the
source options is inconsistent with a Triangle source.
*/
- (BOOL)isTriangleSingleLeadModeEnabled;

- (BOOL)isTriangleSixLeadModeEnabled;

- (ACKEcgRecordingConfig *)recordingWithSingleLeadModeEnabled:(BOOL)enabled;

- (BOOL)validateMonitorOutputFilePath:(nullable NSString *)filePath audioPath:(nullable NSString *)audioPath;

@end

NS_ASSUME_NONNULL_END
