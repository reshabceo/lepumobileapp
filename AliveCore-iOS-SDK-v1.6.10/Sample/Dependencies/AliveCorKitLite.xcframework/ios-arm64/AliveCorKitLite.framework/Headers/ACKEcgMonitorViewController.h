//
//  ACMonitorViewController.h
//  KardiaStation
//
//  Created by Alex Vlasenko on 10/8/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <AliveCorKitLite/ACKEcgMonitorDelegate.h>
#import <AliveCorKitLite/ACKEcgRecordingConfig.h>

@class ACKEcgMonitorViewController;

NS_ASSUME_NONNULL_BEGIN

/**
 * A view controller that guides the user through recording an ECG.
 *
 * @discussion
 * `ACKEcgMonitorViewController` provides a predefined UI and handles the full
 * recording lifecycle, including:
 * 1) device pairing; 2) Bluetooth and/or audio acquisition; 3) Kardia AI
 * evaluation; and 4) error handling and recovery.
 *
 * Callbacks may be delivered on a background queue; dispatch to the main queue
 * before performing UI updates.
 */
@interface ACKEcgMonitorViewController : UIViewController

/**
 * Test stub to drive specific UI scenarios.
 *
 * @discussion
 * For testing only. Currently supports simulating low-battery scenarios.
 */
@property (nonatomic) ACKStub *stub;

/**
 * Creates a monitor with the specified configuration and delegate.
 *
 * @param config   Configuration to apply during recording.
 * @param delegate Delegate that receives monitor events.
 *
 * @return A new instance, or nil if initialization fails.
 */
- (nullable instancetype)initWithConfig:(ACKEcgRecordingConfig *)config delegate:(id<ACKEcgMonitorDelegate>)delegate;

@property (nonatomic, weak, nullable) id<ACKEcgMonitorDelegate> delegate;

/**
 * Creates a monitor with the specified configuration and delegate.
 *
 * @param config   Configuration to apply during recording.
 * @param delegate Delegate that receives monitor events.
 * @param error    Populated if initialization fails.
 *
 * @return A new instance, or nil on failure.
 */
- (nullable instancetype)initWithConfig:(ACKEcgRecordingConfig *)config delegate:(id<ACKEcgMonitorDelegate>)delegate error:(ACKError * _Nullable * _Nullable)error;

- (instancetype)init NS_UNAVAILABLE;

/**
 * Stops the monitor and releases underlying resources.
 *
 * @discussion
 * Invoke this when providing a custom back/close action instead of dismissing
 * the view controller directly.
 */
- (void)stopMonitor;

@end

NS_ASSUME_NONNULL_END
