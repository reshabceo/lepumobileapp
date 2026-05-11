//
//  PDFFactory.h
//  AliveECG
//
//  Created by Ned Fox on 5/22/14.
//  Copyright © 2014 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@class ACKPDFConfig;
@class ACKError;
@class ACKPDFDisplaySettings;
@class ACKPDFMetadata;
@class ACKEcgEvaluation;

/**
 * A utility class for exporting ECG recordings to PDF format.
 *
 * @discussion
 * `ACKPDFReport` provides a set of class methods for generating ECG PDF reports.
 * Each method accepts configuration parameters that define the layout, filter type,
 * metadata, and Kardia AI evaluation results to include in the exported document.
 *
 * The generated PDF is written to a temporary file, and the method returns
 * the file path of the resulting report.
 */
@interface ACKPDFReport : NSObject

/**
 * Generates a PDF report using the specified configuration.
 *
 * @param config The PDF report configuration.
 * @param error  If an error occurs, upon return contains an `ACKError` object describing the problem.
 * @return The file path to the generated PDF report, or `nil` if generation failed.
 */
+ (nullable NSString *)pdfPathForConfig:(ACKPDFConfig *)config
                                  error:(ACKError * _Nullable *_Nullable)error;

/**
 * Generates a PDF report using the specified configuration.
 *
 * @param config The PDF report configuration.
 * @return The file path to the generated PDF report, or `nil` if generation failed.
 */
+ (nullable NSString *)pdfPathForConfig:(ACKPDFConfig *)config;

#if !KARDIACORE
/**
 * Generates a PDF report using the specified configuration and design format.
 *
 * @param config The PDF report configuration.
 * @param showNewPDFDesign If `YES`, the report is generated using the new PDF layout design.
 * @return The file path to the generated PDF report, or `nil` if generation failed.
 */
+ (nullable NSString *)pdfPathForConfig:(ACKPDFConfig *)config
                       showNewPDFDesign:(BOOL)showNewPDFDesign;
#endif

/**
 * Generates a PDF report directly from the provided ECG data and parameters.
 *
 * @param atcFilePath       The file path to the `.atc` ECG data file.
 * @param uuid              The unique identifier displayed in the PDF footer.
 * @param determinationResult The Kardia AI determination result to display in the title.
 * @param allowPVC          Indicates whether PVC (Premature Ventricular Contractions) data should be drawn.
 * @param averageHeartRate  The average heart rate (bpm) to display in the PDF.
 * @param recordedAt        The recording timestamp to display in the PDF.
 * @param isInverted        If `YES`, renders the ECG trace inverted.
 * @param metadata          The patient metadata information.
 * @param settings          The display settings for rendering the PDF.
 * @param algorithmPackage  The algorithm package identifier (e.g., `"kaiv2"` for Kardia AI v2 support).
 * @param averageBeats      The average beat waveform data (used for AI v2).
 * @param beats             The list of detected beats to display.
 * @param intervals         The R–R interval data (used for AI v2).
 * @param error             If an error occurs, upon return contains an `ACKError` object describing the problem.
 *
 * @return The file path to the generated PDF report, or `nil` if generation failed.
 */
+ (nullable NSString *)pdfFromTheAtcFilePath:(NSString *)atcFilePath
                                        uuid:(NSString *)uuid
                         determinationResult:(nullable NSString *)determinationResult
                                    allowPVC:(BOOL)allowPVC
                            averageHeartRate:(CGFloat)averageHeartRate
                                  recordedAt:(nullable NSString *)recordedAt
                                  isInverted:(BOOL)isInverted
                                    metadata:(nullable ACKPDFMetadata *)metadata
                             displaySettings:(nullable ACKPDFDisplaySettings *)settings
                            algorithmPackage:(nullable NSString *)algorithmPackage
                                averageBeats:(nullable NSArray *)averageBeats
                                       beats:(nullable NSArray *)beats
                                   intervals:(nullable NSArray *)intervals
                                       error:(ACKError * _Nullable *_Nullable)error;

#if !KARDIACORE
/**
 * Generates a PDF report directly from the provided ECG data and parameters, with optional design format.
 *
 * @param atcFilePath       The file path to the `.atc` ECG data file.
 * @param uuid              The unique identifier displayed in the PDF footer.
 * @param determinationResult The Kardia AI determination result to display in the title.
 * @param allowPVC          Indicates whether PVC (Premature Ventricular Contractions) data should be drawn.
 * @param averageHeartRate  The average heart rate (bpm) to display in the PDF.
 * @param recordedAt        The recording timestamp to display in the PDF.
 * @param isInverted        If `YES`, renders the ECG trace inverted.
 * @param metadata          The patient metadata information.
 * @param settings          The display settings for rendering the PDF.
 * @param algorithmPackage  The algorithm package identifier (e.g., `"kaiv2"` for Kardia AI v2 support).
 * @param averageBeats      The average beat waveform data (used for AI v2).
 * @param beats             The list of detected beats to display.
 * @param intervals         The R–R interval data (used for AI v2).
 * @param error             If an error occurs, upon return contains an `ACKError` object describing the problem.
 * @param showNewPDFDesign  If `YES`, the report is generated using the new PDF layout design.
 *
 * @return The file path to the generated PDF report, or `nil` if generation failed.
 */
+ (nullable NSString *)pdfFromTheAtcFilePath:(NSString *)atcFilePath
                                        uuid:(NSString *)uuid
                         determinationResult:(nullable NSString *)determinationResult
                                    allowPVC:(BOOL)allowPVC
                            averageHeartRate:(CGFloat)averageHeartRate
                                  recordedAt:(nullable NSString *)recordedAt
                                  isInverted:(BOOL)isInverted
                                    metadata:(nullable ACKPDFMetadata *)metadata
                             displaySettings:(nullable ACKPDFDisplaySettings *)settings
                            algorithmPackage:(nullable NSString *)algorithmPackage
                                averageBeats:(nullable NSArray *)averageBeats
                                       beats:(nullable NSArray *)beats
                                   intervals:(nullable NSArray *)intervals
                                       error:(ACKError * _Nullable *_Nullable)error
                           showNewPDFDesign:(BOOL)showNewPDFDesign;
#endif

@end

NS_ASSUME_NONNULL_END
