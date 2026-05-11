//
//  ACRecordingResultViewController.h
//  AliveECG
//
//  Created by Sophie Smith on 4/5/16.
//  Copyright © 2016 AliveCor Inc. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <AliveCorKitLite/ACKEcgRecordingConfig.h>
#import <AliveCorKitLite/ACKError.h>
#import <AliveCorKitLite/ACKEcgPreviewDelegate.h>

/**
 * A view controller that displays the results of an ECG recording and its Kardia AI evaluation.
 *
 * @discussion
 * `ACKEcgPreviewViewController` presents the ECG waveform, analysis summary,
 * and related diagnostic results. It supports switching between different
 * filter types for previewing the recorded ECG signal.
 */
@interface ACKEcgPreviewViewController : UIViewController

/// The ECG record currently displayed in the preview screen.
@property (nonatomic, copy, readonly, nullable) ACKEcgRecord *record;

/// Use this delegate to respond to user actions (such as tapping Done or Cancel),
/// and to provide custom UI elements (header, footer, or navigation items) for
/// the ECG preview screen.
@property (nonatomic, weak, nullable) id<ACKEcgPreviewDelegate> delegate;

/// The current preview filter applied to the ECG waveform.
@property (nonatomic) ACKFilterType previewFilterType;

/**
 * Initializes a new preview controller with the specified ECG record.
 *
 * @param record The ECG record to be displayed in the preview screen.
 * @return A new instance of `ACKEcgPreviewViewController`.
 */
- (nullable instancetype)initWithRecord:(ACKEcgRecord * _Nonnull)record;

@end
