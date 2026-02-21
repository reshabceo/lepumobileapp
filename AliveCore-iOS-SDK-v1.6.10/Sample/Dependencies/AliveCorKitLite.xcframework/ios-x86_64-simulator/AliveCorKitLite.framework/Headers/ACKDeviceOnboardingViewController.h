//
//  ACKDeviceOnboardingViewController.h
//  AliveECG
//
//  Created by Jim Qin on 5/8/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import <UIKit/UIKit.h>

#import <AliveCorKitLite/ACKTypes.h>

@class ACKDevice;

NS_ASSUME_NONNULL_BEGIN

/**
 *  A view controller that display bluetooth connection flow (currently support Triangle only).
 */
@interface ACKDeviceOnboardingViewController : UIViewController

/**
 * Called when a device is successfully paired
 * @param navigationController the navigationController that embed pairing viewController flow.
*/
typedef void (^ACKDeviceOnboardingPairedBlock)(UINavigationController *navigationController, ACKDevice *device);

/**
 * Called when the user exits the last screen.
 * @param navigationController the navigationController that embed pairing viewController flow.
 */
typedef void (^ACKDeviceOnboardingFinishedBlock)(UINavigationController *navigationController);

/**
 * Called when the user exits the onboarding flow early.
 * @param navigationController the navigationController that embed pairing viewController flow.
 */
typedef void (^ACKDeviceOnboardingCanceledBlock)(UINavigationController *navigationController);

/**
 * Called to present the device paring flow.
 * @param deviceType The onboarding pairing flow for a specific device. (Currently only support Triangle device)
 */
+ (void)presentFromViewController:(UIViewController *)viewController
           modalPresentationStyle:(UIModalPresentationStyle)modalPresentationStyle
                    forDeviceType:(ACKDeviceType)deviceType
                    finishedBlock:(nullable ACKDeviceOnboardingFinishedBlock)finishedBlock
                    canceledBlock:(nullable ACKDeviceOnboardingCanceledBlock)canceledBlock
                      pairedBlock:(nullable ACKDeviceOnboardingPairedBlock)pairedBlock;

@end

NS_ASSUME_NONNULL_END
