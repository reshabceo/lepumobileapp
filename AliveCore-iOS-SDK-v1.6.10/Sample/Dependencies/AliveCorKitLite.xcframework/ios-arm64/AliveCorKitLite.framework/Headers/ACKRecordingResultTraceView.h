//
//  ACKRecordingResultTraceView.h
//  AliveECG
//
//  Created by Sophie Smith on 4/5/16.
//  Copyright © 2016 AliveCor Inc. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <AliveCorKitLite/ACKTypes.h>

@class ACKEcgFileView;
@class ACKEcgRecord;

/**
 * Sentinel height value indicating the view should size itself automatically.
 *
 * Use `ACKRecordingResultTraceViewAutomaticDimension` when you want the view’s
 * height to be resolved by its internal layout and your external constraints.
 */
extern const CGFloat ACKRecordingResultTraceViewAutomaticDimension;

/**
 * Delegate methods for customizing and responding to interactions in
 * `ACKRecordingResultTraceView`.
 */
@protocol ACKRecordingResultTraceViewDelegate <NSObject>
@optional

/**
 * Returns a custom height for the trace view based on the current leads configuration.
 *
 * If not implemented, the view falls back to Auto Layout constraints.
 *
 * @param leadsConfig The active leads configuration.
 * @return The desired height in points.
 *
 * - Warning: AliveCor internal use only.
 *   Provided for backward compatibility with the Kardia app.
 *   // __attribute__((deprecated("Use ACKEcgRecordingTraceView")))
 */
- (CGFloat)recordingResultTraceViewHeightForLeadsConfig:(ACKLeadsConfig)leadsConfig;

/**
 * Notifies the delegate that the Invert ECG button was pressed.
 *
 * - Warning: AliveCor internal use only.
 *   // __attribute__((deprecated("Use ACKEcgRecordingTraceView")))
 */
- (void)recordingResultTraceViewPressedInvertEcgButton;

/**
 * Notifies the delegate that the Algorithm Info button was pressed.
 *
 * - Warning: AliveCor internal use only.
 *   // __attribute__((deprecated("Use ACKEcgRecordingTraceView")))
 */
- (void)recordingResultTraceViewPressedAlgorithmInfoButton;

@end

/**
 * An ECG recording view that displays the waveform along with lead labels,
 * scaling factors, Kardia AI determination, and average heart rate.
 *
 * @note Using this class requires adopting `ACKRecordingResultTraceViewDelegate`.
 */
@interface ACKRecordingResultTraceView : UIView

/// The button used to invert the ECG trace.
@property (nonatomic, readonly) UIButton *invertButton;

/**
 * Initializes a trace view with a given ECG, file view, layout mode, and delegate.
 *
 * @param ecg              The ECG record to display.
 * @param fileView         The file view responsible for rendering the waveform.
 * @param largeLayout      Pass YES to use the large layout; NO for compact.
 * @param supportsLandscape Pass YES to allow landscape layout; NO otherwise.
 * @param delegate         The delegate that receives interaction callbacks.
 *
 * @return An initialized trace view.
 *
 * // __attribute__((deprecated("Use ACKEcgRecordingTraceView")))
 */
- (instancetype)initWithEcg:(ACKEcgRecord *)ecg
                   fileView:(ACKEcgFileView *)fileView
                largeLayout:(BOOL)largeLayout
          supportsLandscape:(BOOL)supportsLandscape
                   delegate:(id<ACKRecordingResultTraceViewDelegate>)delegate;

/**
 * Returns the standardized height for single-lead display, given the current
 * recording mode, layout, and orientation.
 *
 * @return The recommended height in points.
 *
 * // __attribute__((deprecated("Use ACKEcgRecordingTraceView")))
 */
- (NSInteger)standardHeightForSingleLead;

@end
