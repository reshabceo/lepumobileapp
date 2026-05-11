//
//  ACKEvaluationResult.h
//  AliveCorKit
//
//  Created by Alex Vlasenko on 12/13/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKTypes.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Represents the results of an ECG evaluation performed by Kardia AI.
 *
 * @discussion
 * This class encapsulates diagnostic information derived from an ECG analysis,
 * including algorithm determination, modifiers, calculated metrics such as
 * heart rate, and localized diagnostic descriptions. It also includes metadata
 * such as algorithm version and package identifiers.
 */
@interface ACKEcgEvaluation : NSObject

/// The version of the Kardia AI library used for this evaluation.
@property (nonatomic, copy, readonly) NSString *version;

/// The algorithm package used for the evaluation (e.g., `"kaiv2"`).
@property (nonatomic, copy, readonly) NSString *algorithmPackage;

/// The primary determination result produced by Kardia AI.
@property (nonatomic, copy, readonly) ACKAlgorithmDetermination determination;

/// Additional modifier describing characteristics of the detected rhythm.
@property (nonatomic, copy, readonly) ACKDeterminationModifier modifier;

/**
 * The average heart rate measured during the recording, in beats per minute (bpm).
 *
 * @discussion
 * The valid range is 30–220 bpm. If the detected heart rate falls outside these
 * bounds, or the signal quality is too poor to provide a reliable estimate,
 * the returned value is `0`.
 */
@property (nonatomic, readonly) CGFloat averageHeartRate;

/// An array of errors encountered during evaluation, if any.
@property (nonatomic, readonly) NSArray *errors;

/// Indicates whether the ECG signal was inverted.
@property (nonatomic) BOOL isInverted;

/// Average beat data provided by Kardia AI.
@property (nonatomic, copy, nullable) NSArray *averageBeats;

/// Detected individual beats with annotations, as calculated by Kardia AI.
@property (nonatomic, copy, nullable) NSArray *beats;

/// R–R interval values provided by Kardia AI.
@property (nonatomic, copy, nullable) NSArray *intervals;

#pragma mark - Determination Labels

/**
 * Returns a short, human-readable label for the current determination.
 *
 * @return Example: `"Sinus Rhythm"`, `"Unclassified"`.
 */
- (NSString *)determinationLabel;

/**
 * Returns a short, human-readable label combining the determination and modifier.
 *
 * @return Example: `"Normal Sinus Rhythm"`, `"Sinus Rhythm with VEBs"`.
 */
- (NSString *)determinationWithModifierLabel;

#pragma mark - Localized Descriptions

/**
 * Returns the localized short title for the diagnosis.
 *
 * @return Example: `"Normal"`, `"Too Short"`.
 */
- (NSString *)localizedDeterminationShortTitle;

/**
 * Returns the localized short title for the diagnosis in the specified language.
 */
- (NSString *)localizedDeterminationShortTitle:(nullable ACKLanguageType)type;

/**
 * Returns the full localized diagnostic description.
 *
 * @discussion
 * Includes the analysis summary, disclaimer, and any additional information.
 *
 * @return Example:
 * `"No rhythm abnormalities detected in your EKG. Kardia cannot detect signs of a heart attack.
 * If you believe you are having a medical emergency, call emergency services."`
 */
- (NSString *)localizedDescription;

/**
 * Returns the full localized diagnostic description in the specified language.
 */
- (NSString *)localizedDescription:(nullable ACKLanguageType)type;

/**
 * Returns the localized algorithm determination description.
 *
 * @return Example: `"No rhythm abnormalities detected in your EKG."`
 */
- (NSString *)localizedDeterminationDescription;

/**
 * Returns the localized algorithm determination description in the specified language.
 */
- (NSString *)localizedDeterminationDescription:(nullable ACKLanguageType)type;

/**
 * Returns the localized disclaimer text for the analysis.
 *
 * @return Example:
 * `"Kardia cannot detect signs of a heart attack. If you believe you are having a medical emergency,
 * call emergency services. DO NOT change your medication without talking to your doctor."`
 */
- (NSString *)localizedDisclaimer;

/**
 * Returns the localized disclaimer text for the specified language.
 */
- (NSString *)localizedDisclaimer:(nullable ACKLanguageType)type;

/**
 * Returns the localized additional information for this analysis result.
 *
 * @return Example:
 * `"Atrial fibrillation was not detected and your EKG does not fall under
 * the classifications of Normal, Bradycardia, or Tachycardia. This may be
 * caused by other arrhythmias, unusually fast or slow heart rates, or
 * poor quality recordings."`
 */
- (NSString *)localizedAdditionalInformation;

/**
 * Returns the localized additional information for the specified language.
 */
- (NSString *)localizedAdditionalInformation:(nullable ACKLanguageType)type;

/**
 * Returns the localized descriptive title of the algorithm result.
 *
 * @return Example: `"Normal"`, `"Your EKG recording was interrupted"`.
 */
- (NSString *)localizedDeterminationTitle;

/**
 * Returns the localized descriptive title of the algorithm result
 * in the specified language.
 */
- (NSString *)localizedDeterminationTitle:(nullable ACKLanguageType)type;

/// Returns the color associated with this determination result.
- (UIColor *)determinationColor;

#pragma mark - Legacy Mapping

/**
 * Maps a set of legacy boolean flags to a modern algorithm determination value.
 *
 * @param afibDetected        The legacy AFib detection flag.
 * @param nsrDetected         The legacy Normal Sinus Rhythm detection flag.
 * @param noiseDetected       The legacy noise detection flag.
 * @param durationMilliseconds The duration of the ECG recording, in milliseconds.
 *
 * @return The corresponding `ACKAlgorithmDetermination` value.
 */
+ (ACKAlgorithmDetermination)ecgAlgorithmDeterminationForAfibDetected:(BOOL)afibDetected
                                                          nsrDetected:(BOOL)nsrDetected
                                                        noiseDetected:(BOOL)noiseDetected
                                                 durationMilliseconds:(NSInteger)durationMilliseconds;

#pragma mark - Initialization

/**
 * Initializes an evaluation result with the given Kardia AI data.
 *
 * @param version           The Kardia AI version.
 * @param algorithmPackage  The algorithm package used for evaluation.
 * @param determination     The algorithm’s primary determination result.
 * @param modifier          The determination modifier.
 * @param averageHeartRate  The average heart rate in bpm.
 * @param isInverted        Whether the ECG trace is inverted.
 * @param errors            Any errors generated during evaluation.
 *
 * @return A new instance of `ACKEcgEvaluation`.
 */
- (instancetype)initWithKaiVersion:(NSString *)version algorithmPackage:(NSString *)algorithmPackage determination:(NSString *)determination modifier:(NSString *)modifier averageHeartRate:(CGFloat)averageHeartRate isInverted:(BOOL)isInverted errors:(NSArray * _Nullable)errors;

@end

NS_ASSUME_NONNULL_END
