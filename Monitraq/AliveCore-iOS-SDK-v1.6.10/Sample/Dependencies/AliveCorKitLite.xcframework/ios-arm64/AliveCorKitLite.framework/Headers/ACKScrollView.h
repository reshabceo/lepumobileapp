//
//  ECGScrollView.h
//  AliveECG
//
//  Created by Sophie Smith on 4/26/16.
//  Copyright © 2016 AliveCor Inc. All rights reserved.
//

#import <UIKit/UIKit.h>

@class ACKEcgFileView;

NS_ASSUME_NONNULL_BEGIN

/**
 * A scrollable container for displaying ECG charts.
 *
 * @discussion
 * `ACKScrollView` embeds an `ACKEcgFileView` inside a `UIScrollView`,
 * providing horizontal scrolling for long ECG traces.
 * It is typically used to present recorded ECG data that extends
 * beyond the visible screen width.
 */
@interface ACKScrollView : UIView

/// The underlying scroll view that enables horizontal scrolling.
@property (nonatomic, readonly) UIScrollView *scrollView;

/// The ECG file view being displayed inside the scroll view.
@property (nonatomic) ACKEcgFileView *fileView;

/// Indicates whether scrolling is enabled.
@property (nonatomic) BOOL scrollEnabled;

/**
 * Initializes a scrollable ECG view with the given file view.
 *
 * @param fileView The `ACKEcgFileView` instance to display.
 * @return An initialized scroll view instance.
 */
- (instancetype)initWithEcgFileView:(ACKEcgFileView *)fileView;

@end

NS_ASSUME_NONNULL_END
