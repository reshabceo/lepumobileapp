//
//  ACKEcgPreviewDelegate.h
//  AliveCorKitExample
//
//  Created by Alex Vlasenko on 1/9/20.
//  Copyright © 2020 AliveCor, Inc. All rights reserved.
//

#ifndef ACKEcgPreviewDelegate_h
#define ACKEcgPreviewDelegate_h

@class ACKEcgPreviewViewController;
@class ACKEcgMonitorState;
@class ACKEcgRecord;

/**
 * Defines methods that allow the delegate to manage interactions and customize
 * the appearance of the ECG results screen presented by `ACKEcgPreviewViewController`.
 *
 * @discussion
 * Use this protocol to respond to user actions (such as tapping Done or Cancel),
 * and to provide custom UI elements (header, footer, or navigation items) for
 * the ECG preview screen.
 */
@protocol ACKEcgPreviewDelegate <NSObject>

@optional

/**
 * Notifies the delegate that the Done button was tapped.
 *
 * @param viewController The ECG preview view controller.
 * @param record         The ECG record associated with the completed recording.
 */
- (void)ecgPreviewViewController:(ACKEcgPreviewViewController * _Nonnull)viewController
              didFinishWithRecord:(ACKEcgRecord * _Nullable)record;

/**
 * Notifies the delegate that the Cancel button was tapped.
 *
 * @param viewController The ECG preview view controller.
 * @param record         The ECG record associated with the canceled recording.
 */
- (void)ecgPreviewViewController:(ACKEcgPreviewViewController * _Nonnull)viewController
              didCancelWithRecord:(ACKEcgRecord * _Nullable)record;

/**
 * Asks the delegate whether the Done button should be displayed.
 *
 * @param viewController The ECG preview view controller.
 * @return YES to display the Done button; NO otherwise.
 */
- (BOOL)showDoneButtonInEcgPreviewViewController:(ACKEcgPreviewViewController * _Nonnull)viewController;

/**
 * Asks the delegate whether the Cancel button should be displayed.
 *
 * @param viewController The ECG preview view controller.
 * @return YES to display the Cancel button; NO otherwise.
 */
- (BOOL)showCancelButtonInEcgPreviewViewController:(ACKEcgPreviewViewController * _Nonnull)viewController;

/**
 * Asks the delegate for a custom footer view to display at the bottom of the preview screen.
 *
 * @param viewController The ECG preview view controller.
 * @return A custom footer view, or nil to use the default footer.
 */
- (UIView * _Nullable)footerViewForEcgPreviewViewController:(ACKEcgPreviewViewController * _Nonnull)viewController;

/**
 * Asks the delegate for a custom header view to display at the top of the preview screen.
 *
 * @param viewController The ECG preview view controller.
 * @return A custom header view, or nil to use the default header.
 */
- (UIView * _Nullable)headerViewForEcgPreviewViewController:(ACKEcgPreviewViewController * _Nonnull)viewController;

/**
 * Asks the delegate for a custom right navigation bar button item.
 *
 * @param viewController The ECG preview view controller.
 * @return A custom right bar button item, or nil to use the default item.
 */
- (UIBarButtonItem * _Nullable)rightItemViewForEcgPreviewViewController:(ACKEcgPreviewViewController * _Nonnull)viewController;

/**
 * Asks the delegate for a custom left navigation bar button item.
 *
 * @param viewController The ECG preview view controller.
 * @return A custom left bar button item, or nil to use the default item.
 */
- (UIBarButtonItem * _Nullable)leftItemViewForEcgPreviewViewController:(ACKEcgPreviewViewController * _Nonnull)viewController;

/**
 * Asks the delegate whether the ECG preview screen should support landscape orientation.
 *
 * @param viewController The ECG preview view controller.
 * @return YES to allow landscape mode; NO otherwise.
 */
- (BOOL)supportLandscapeModeForEcgPreviewViewController:(ACKEcgPreviewViewController * _Nonnull)viewController;

/**
 * Notifies the delegate that the user tapped the Invert button.
 *
 * @param viewController The ECG preview view controller.
 * @param record         The ECG record after inversion.
 */
- (void)ecgPreviewViewController:(ACKEcgPreviewViewController * _Nonnull)viewController
                didInvertRecord:(ACKEcgRecord * _Nullable)record;

@end

#endif /* ACKEcgPreviewDelegate_h */
