//
//  ACKPDPPreviewController.h
//  AliveECG
//
//  Created by Jim Qin on 8/16/16.
//  Copyright © 2016 AliveCor Inc. All rights reserved.
//

#import <QuickLook/QuickLook.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * A view controller for displaying a PDF file.
 *
 * @discussion
 * `ACKPDPPreviewController` presents a PDF file using Quick Look (`QLPreviewController`).
 * The file is expected to be temporary and will be automatically deleted when the
 * view controller is dismissed. This class is typically used to display generated
 * ECG reports or other transient PDF documents within the AliveCor SDK.
 */
@interface ACKPDPPreviewController : QLPreviewController

/**
 * Creates and returns a PDF preview controller configured to display the specified file.
 *
 * The PDF file is expected to be a temporary file that will be deleted automatically
 * after the controller is dismissed.
 *
 * @param filePath          The full path to the PDF file.
 * @param title             The title displayed in the navigation bar.
 * @param supportsLandscape Indicates whether landscape orientation is supported.
 *
 * @return A configured instance of `ACKPDPPreviewController`, or `nil` if initialization fails.
 */
+ (nullable instancetype)viewControllerWithPdfFilePath:(NSString *)filePath
                                    navigationBarTitle:(NSString *)title
                                     supportsLandscape:(BOOL)supportsLandscape;

/**
 * Creates and returns a PDF preview controller configured to display the specified file.
 *
 * The PDF file is expected to be a temporary file that will be deleted automatically
 * after the controller is dismissed.
 *
 * @param filePath The full path to the PDF file.
 * @param title    The title displayed in the navigation bar.
 *
 * @return A configured instance of `ACKPDPPreviewController`, or `nil` if initialization fails.
 */
+ (nullable instancetype)viewControllerWithPdfFilePath:(NSString *)filePath
                                    navigationBarTitle:(NSString *)title;

@end

NS_ASSUME_NONNULL_END
