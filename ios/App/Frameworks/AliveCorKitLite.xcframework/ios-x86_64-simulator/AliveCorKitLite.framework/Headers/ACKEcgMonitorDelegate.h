//
//  ACMonitorViewControllerDelegate.h
//  ACKit
//
//  Created by Alex Vlasenko on 10/30/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#ifndef ACMonitorViewControllerDelegate_h
#define ACMonitorViewControllerDelegate_h

#import <UIKit/UIKit.h>
#import <AliveCorKitLite/ACKTypes.h>
#import <AliveCorKitLite/ECGData.h>

@class ACKEcgMonitorViewController;
@class ACKEcgRecord;
@class ACKError;
@class ACKEcgRecordingConfig;
@class ACKDevice;

/**
 * Delegate methods for tracking ECG recording progress, handling UI actions,
 * and receiving completion and error callbacks from `ACKEcgMonitorViewController`.
 */
@protocol ACKEcgMonitorDelegate <NSObject>

@optional

/**
 * Notifies the delegate that a device connected and is ready to record.
 *
 * @param viewController   The ECG monitoring view controller.
 * @param device           The connected device that will be used for recording.
 * @param continueHandler  Call with YES to proceed with recording, or NO to stop
 *                         the monitor. If NO, it is the caller’s responsibility
 *                         to dismiss the monitor view controller.
 */
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController didConnectWithDevice:(ACKDevice * _Nonnull)device continueWithRecording:(void (^ _Nonnull)(BOOL))continueHandler;

/**
 * Notifies the delegate that the recording was canceled.
 *
 * @param viewController The ECG monitoring view controller.
 * @param error          An error describing why cancellation occurred, or nil if none.
 */
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController didCancelWithError:(nullable ACKError *)error;

/**
 * Notifies the delegate that the Settings button was pressed.
 *
 * @param viewController The ECG monitoring view controller.
 * @param config         The current ECG monitor configuration.
 */
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController didPressSettingWithConfig:(nullable ACKEcgRecordingConfig *)config;

/**
 * Notifies the delegate that recording completed successfully.
 *
 * @param viewController The ECG monitoring view controller.
 * @param record         The resulting ECG record.
 */
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController didCompleteRecording:(nullable ACKEcgRecord *)record;

/**
 * Reports an error encountered during recording.
 *
 * @param viewController The ECG monitoring view controller.
 * @param error          The recording error.
 */
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController didEncounterError:(nullable ACKError *)error;

/**
 * Asks the delegate whether the Cancel button should be displayed.
 *
 * @param viewController The ECG monitoring view controller.
 * @return YES to show the Cancel button; NO otherwise.
 */
- (BOOL)showCancelButtonInEcgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController;

/**
 * Asks the delegate whether the Settings button should be displayed.
 *
 * @param viewController The ECG monitoring view controller.
 * @return YES to show the Settings button; NO otherwise.
 */
- (BOOL)showSettingsButtonInEcgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController;

/**
 * Requests a custom right bar button item for the navigation bar.
 *
 * @discussion
 * If implemented, this supersedes `showSettingsButtonInEcgMonitorViewController:`.
 *
 * @param viewController The ECG monitoring view controller.
 * @return The custom right bar button item, or nil to use the default behavior.
 */
- (UIBarButtonItem * _Nullable)rightItemViewForEcgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController;

/**
 * Requests a custom left bar button item for the navigation bar.
 *
 * @discussion
 * If implemented, this supersedes `showCancelButtonInEcgMonitorViewController:`.
 *
 * @param viewController The ECG monitoring view controller.
 * @return The custom left bar button item, or nil to use the default behavior.
 */
- (UIBarButtonItem * _Nullable)leftItemViewForEcgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController;

/**
 * Asks the delegate for additional text to display in the “confirm recording” dialog.
 *
 * @param viewController The ECG monitoring view controller.
 * @return A message to display in the confirmation dialog, or nil for none.
 */
- (NSString * _Nullable)confirmRecordingMessageForEcgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController;

/**
 * Notifies the delegate that the lead configuration changed.
 *
 * @param viewController The ECG monitoring view controller.
 * @param config         The new leads configuration.
 */
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController didChangeLeadsConfig:(ACKLeadsConfig)config;

/**
 * Asks the delegate whether switching lead mode is allowed.
 *
 * @param viewController The ECG monitoring view controller.
 * @return YES to enable lead-mode switching; NO otherwise.
 */
- (BOOL)ecgMonitorViewControllerShouldEnableLeadModeSwitch:(ACKEcgMonitorViewController * _Nonnull)viewController;

/// Notifies the delegate of a detected battery level on the connected device.
/// @param viewController  The ECG monitoring view controller.
/// @param connectedDevice The connected BLE device.
/// @param batteryLevel    The detected battery level.
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController connectedDevice:(ACKDevice * _Nonnull)connectedDevice batteryLevelDetected:(NSInteger)batteryLevel;

/**
 * Asks the delegate whether the lead selection should be displayed.
 *
 * @param viewController The ECG monitoring view controller.
 * @return YES to display lead selection; NO otherwise.
 */
- (BOOL)ecgMonitorViewControllerShouldDisplayLeadSelection:(ACKEcgMonitorViewController * _Nonnull)viewController deviceType:(ACKDeviceType _Nonnull)deviceType;


/**
 * Reports an audio-related error encountered during recording.
 *
 * @discussion
 * Called only for ultrasound devices (Kardia Mobile, Omron Complete).
 * If not implemented, the SDK shows an alert and exits the recording flow.
 *
 * @param viewController The ECG monitoring view controller.
 * @param error          The audio error.
 */
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController didEncounterAudioError:(nullable ACKError *)error;

/**
 * Requests the list of paired device types available to the user.
 *
 * @param viewController The ECG monitoring view controller.
 * @return An array of paired device types.
 */
- (NSArray<ACKDeviceType> * _Nonnull)availableDeviceTypes:(ACKEcgMonitorViewController * _Nonnull)viewController;

/**
 * Notifies the delegate that the “Add New Device” button was tapped.
 *
 * @param viewController The ECG monitoring view controller.
 */
- (void)didPressAddNewDevice:(ACKEcgMonitorViewController * _Nonnull)viewController;

/**
 * Notifies the delegate that the user selected a different device type.
 *
 * @param viewController The ECG monitoring view controller.
 * @param deviceType     The newly selected device type.
 */
- (void)didChangeToDevice:(ACKEcgMonitorViewController * _Nonnull)viewController
               deviceType:(ACKDeviceType _Nonnull)deviceType;

/**
 * Provides real-time filtered ECG samples for live preview during recording.
 *
 * @param viewController The ECG monitoring view controller.
 * @param ecgFrame       The most recent samples from each ECG lead.
 */
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController didReceiveEcgFrame:(struct ECGFrame)ecgFrame;

#pragma mark - Internal (AliveCor use only)
/// - Warning: AliveCor internal use only.

/**
 * Reports a pairing error encountered while connecting to a device.
 *
 * @param viewController The ECG monitoring view controller.
 * @param error          The pairing error.
 * @param completion     The delegate must call the completion block to restart device scanning.
 */
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController
  didEncounterInvalidDeviceError:(nullable ACKError *)error
                      completion:(void (^ _Nonnull)(void))completion;

/**
 * Asks the delegate whether connecting to a given device type is allowed.
 *
 * This is called before initiating connection or pairing when a device of the
 * specified type is discovered, and the SDK may adjust scan/pairing behavior
 * based on the answer.
 *
 * @param viewController       The ECG monitoring view controller.
 * @param deviceType           The device type the monitor is about to connect to.
 * @param configuredDeviceType The device type currently configured for this monitor.
 *
 * @return YES to allow connecting/scanning for the given device type; NO to
 *         prevent connection and keep the current pairing/scan behavior unchanged.
 */
- (BOOL)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController
       isAllowDiscoverDeviceType:(ACKDeviceType _Nonnull)deviceType
            configuredDeviceType:(ACKDeviceType _Nonnull)configuredDeviceType;

/// Asks the delegate for a device's battery percentage corresponding to a device type, used to display battery percentage on the monitoring screen.
/// The return value should be an integer percentage in the range 0–100. Return -1 if the
/// battery level is unknown.
/// @param viewController The ECG monitoring view controller.
/// @param deviceType     The currently selected device type.
- (NSInteger)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController initialBatteryPercentageForDeviceType:(ACKDeviceType _Nonnull)deviceType;

/// - Warning: AliveCor internal use only.
/// Asks whether tutorial support is enabled.
/// @return YES if tutorial is supported; NO otherwise.
- (BOOL)ecgMonitorViewControllerShouldEnableTutorial:(ACKEcgMonitorViewController * _Nonnull)viewController;

/// - Warning: AliveCor internal use only.
/// Notifies the delegate that the tutorial is about to start.
/// @param viewController  The ECG monitoring view controller.
/// @param spots           Optional tutorial spots/steps.
/// @param tutorialCompletionHandler  Called when the tutorial finishes.
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController willStartTutorialWithSpots:(NSArray * _Nullable)spots tutorialCompletionHandler:(void (^ _Nullable)(void))tutorialCompletionHandler;

/// - Warning: AliveCor internal use only.
/// Notifies the delegate that `viewDidAppear` occurred; tutorials may be shown here.
/// @param viewController  The ECG monitoring view controller.
/// @param spots           Optional tutorial spots/steps.
/// @param tutorialCompletionHandler  Called when the tutorial finishes.
- (void)ecgMonitorViewController:(ACKEcgMonitorViewController * _Nonnull)viewController viewDidAppearWithSpots:(NSArray * _Nullable)spots tutorialCompletionHandler:(void (^ _Nullable)(void))tutorialCompletionHandler;

@end

#endif /* ACMonitorViewControllerDelegate_h */
