//
//  ACKKardiaMobileDevice.h
//  AliveCorKitExample
//
//  Created by Ishan Vijay Alone on 15/07/25.
//  Copyright © 2025 AliveCor. All rights reserved.
//

#import <Foundation/Foundation.h>

@class ACKardiaMobileDevice;


@protocol AudioDeviceDelegateHandler <NSObject>
- (void)audioDeviceDidEncounterError:(NSError *_Nullable)error;
@end
NS_ASSUME_NONNULL_BEGIN

@interface ACKKardiaMobileDevice : NSObject
- (instancetype)initWithVoiceRecordingEnabled:(BOOL)voiceRecordingEnabled andAudioDeviceHandler:(nullable id<AudioDeviceDelegateHandler>)handler;


- (ACKardiaMobileDevice *)kardiaMobileDevice;
/**
 * Start capturing audio and attempting to decode FM.
 */
- (void)startCapturing;

/**
 * Stop capturing.
 */
- (void)stopCapturing;

@end

NS_ASSUME_NONNULL_END
