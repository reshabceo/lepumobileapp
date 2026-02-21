//
//  ECGMonitorRecordingView.h
//  AliveECG
//
//  Created by Frank Petterson on 6/24/16.
//  Copyright © 2016 AliveCor Inc. All rights reserved.
//

#import <UIKit/UIKit.h>
#import "ECGData.h"

@class ECGView;
@class ACKEcgRecordingConfig;

@interface ECGMonitorRecordingView : UIView
- (instancetype)initWithRecording:(ACKEcgRecordingConfig *)recording;
// Change the recording mode between single and dual lead recording.
- (void)setModeWithRecording:(ACKEcgRecordingConfig *)recording;
- (void)showNormalBeatWithSampleCountDelay:(NSInteger)delay;

// ECGMonitor also uses ecgView so allow it to be accessed. It's not great but it'll have to do for now
- (ECGView *)getEcgView;
// EcgViewRight is nonnull if the recording is a triangle dual lead recording. Otherwise, returns nil.
- (ECGView *)getEcgViewRight;

- (void)startRenderingEcg;
- (void)stopRenderingEcg;

@end
