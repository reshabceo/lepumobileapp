//
//  ACKPDFInteractionController.h
//  AliveCorKitExample
//
//  Created by Alex Vlasenko on 4/24/20.
//  Copyright © 2020 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@class ACKPDFConfig;
@class ACKError;

/**
 * Protocol defining methods for monitoring and managing PDF generation events.
 */
@class ACKPDFInteractionController;
@protocol ACKPDFInteractionControllerDelegate <NSObject>

@optional

/**
 * Notifies the delegate that PDF generation is about to begin.
 *
 * @param controller The PDF interaction controller.
 * @param config The configuration defining the content of the PDF report.
 */
- (void)pdfInteractionController:(ACKPDFInteractionController * _Nonnull)controller
         willPresentPdfForConfig:(ACKPDFConfig *)config;

/**
 * Notifies the delegate that PDF generation has completed.
 *
 * @param controller The PDF interaction controller.
 * @param config The configuration of the PDF report.
 * @param pdfPath The file path of the generated PDF report, or `nil` if generation failed.
 * @param error The error that occurred during generation, or `nil` if successful.
 */
- (void)pdfInteractionController:(ACKPDFInteractionController * _Nonnull)controller
                   didPresentPdf:(NSString * _Nullable)pdfPath
                       forConfig:(ACKPDFConfig *)config
                       withError:(ACKError * _Nullable)error;

/**
 * Requests the delegate to handle PDF encryption.
 *
 * @param controller The PDF interaction controller.
 * @param password The password to be used for PDF encryption.
 * @param config The configuration of the PDF report.
 * @param completionHandler A block to be executed upon completion of the encryption process.
 *        The handler returns either the file path of the encrypted PDF or an error if encryption fails.
 */
- (void)pdfInteractionController:(ACKPDFInteractionController * _Nonnull)controller
          encryptPDFWithPassword:(NSString * _Nullable)password
                      withConfig:(ACKPDFConfig *)config
               completionHandler:(void (^)(NSError * _Nullable error, NSString * _Nullable pdfPath))completionHandler;

@end


/**
 * A controller that manages the creation and presentation of ECG PDF reports.
 *
 * @discussion
 * `ACKPDFInteractionController` takes an instance of `ACKPDFConfig` that defines
 * what data should be included in the report. When `presentPdfPreviewForConfig:onViewController:supportsLandscape:showEncryptionPrompt:encryptionRequired:`
 * is called, the SDK generates the PDF file, optionally requests encryption,
 * and presents a preview to the user.
 *
 * - Note: Using this class requires adopting the `ACKPDFInteractionControllerDelegate` protocol.
 * - Important: The SDK does **not** perform encryption itself. The host application
 *   is responsible for implementing encryption logic in compliance with regional requirements.
 */
@interface ACKPDFInteractionController : NSObject

/// The delegate that receives PDF creation and encryption events.
@property (nonatomic, weak, nullable) id<ACKPDFInteractionControllerDelegate> delegate;

/**
 * Initializes a PDF interaction controller with the given configuration.
 *
 * @param config The configuration of the PDF report.
 * @param error  An optional error pointer set if initialization fails.
 * @return A new instance of the PDF interaction controller.
 */
- (instancetype)initWithConfig:(ACKPDFConfig *)config error:(ACKError * _Nullable *_Nullable)error;

/**
 * Initializes a PDF interaction controller with the given configuration.
 *
 * @param config The configuration of the PDF report.
 * @return A new instance of the PDF interaction controller.
 */
- (instancetype)initWithConfig:(ACKPDFConfig *)config;

/// Unavailable. Use `initWithConfig:` instead.
- (instancetype)init NS_UNAVAILABLE;

/**
 * Presents the PDF preview for the specified configuration.
 *
 * @param config The configuration of the PDF report.
 * @param viewController The parent view controller on which the preview should be presented.
 * @param supportsLandscape Indicates whether landscape orientation is supported.
 * @param showEncryptionPrompt Whether to display an encryption prompt during PDF creation.
 * @param encryptionRequired Indicates whether encryption is mandatory (for example, in certain countries such as Norway).
 */
- (void)presentPdfPreviewForConfig:(ACKPDFConfig *)config
                  onViewController:(__kindof UIViewController *)viewController
                 supportsLandscape:(BOOL)supportsLandscape
              showEncryptionPrompt:(BOOL)showEncryptionPrompt
                encryptionRequired:(BOOL)encryptionRequired;

@end

NS_ASSUME_NONNULL_END
