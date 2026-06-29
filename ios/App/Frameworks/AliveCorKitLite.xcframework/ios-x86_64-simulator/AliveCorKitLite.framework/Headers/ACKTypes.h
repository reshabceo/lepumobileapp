//
//  ACKTypes.h
//  AliveCorKitExample
//
//  Created by Alex Vlasenko on 1/8/20.
//  Copyright © 2020 AliveCor, Inc. All rights reserved.
//

#ifndef ACKTypes_h
#define ACKTypes_h

/**
 * Filter applied to the ECG recording preview.
 */
typedef NS_ENUM(NSInteger, ACKFilterType) {
    ACKFilterTypeEnhanced = 1,
    ACKFilterTypeOriginal
};

/**
 * Algorithm version used when interpreting ECG results.
 */
typedef NS_ENUM(NSInteger, ACKAlgorithmVersion) {
    ACKAlgorithmVersionKAIV1 = 1,
    ACKAlgorithmVersionKAIV2
};

/**
 * Post-EKG result screen type.
 */
typedef NS_ENUM(NSInteger, ACKResultScreenType) {
    ACKResultScreenTypeNone = 1,
    ACKResultScreenTypeEKG,
    ACKResultScreenTypeDone
};

/**
 * Recording lead configuration applied to the device
 * (either single-lead or six-lead).
 */
typedef NS_ENUM(NSInteger, ACKLeadsConfig) {
    ACKLeadsConfigSingle = 1,
    ACKLeadsConfigSix
};

/**
 * Power-line (mains) frequency at the time of recording (Hz).
 * Use 50 or 60 Hz.
 */
typedef NS_ENUM(NSUInteger, ACKMainsFrequency) {
    ACKMainsFrequency60Hz = 60,
    ACKMainsFrequency50Hz = 50,
};

/**
 * Sampling frequency of the ECG signal (Hz).
 */
typedef NS_ENUM(NSUInteger, ACKSampleRate) {
    ACKSampleRate125Hz = 125,
    ACKSampleRate250Hz = 250,
    ACKSampleRate300Hz = 300,
    ACKSampleRate500Hz = 500,
    ACKSampleRate600Hz = 600,
};

/**
 * String-backed enumeration of Kardia AI determination codes.
 * Represents both the determination and its corresponding status code.
 */
typedef NSString * ACKAlgorithmDetermination NS_STRING_ENUM;
extern ACKAlgorithmDetermination _Nonnull ACKAlgorithmDeterminationUnsupported;
extern ACKAlgorithmDetermination _Nonnull ACKAlgorithmDeterminationNoAnalysis;
extern ACKAlgorithmDetermination _Nonnull ACKAlgorithmDeterminationUnreadable;
extern ACKAlgorithmDetermination _Nonnull ACKAlgorithmDeterminationTooShort;
extern ACKAlgorithmDetermination _Nonnull ACKAlgorithmDeterminationTooLong;
extern ACKAlgorithmDetermination _Nonnull ACKAlgorithmDeterminationUnclassified;
extern ACKAlgorithmDetermination _Nonnull ACKAlgorithmDeterminationSinusRhythm;
extern ACKAlgorithmDetermination _Nonnull ACKAlgorithmDeterminationNormal;
extern ACKAlgorithmDetermination _Nonnull ACKAlgorithmDeterminationAtrialFibrillation;
extern ACKAlgorithmDetermination _Nonnull ACKAlgorithmDeterminationBradycardia;
extern ACKAlgorithmDetermination _Nonnull ACKAlgorithmDeterminationTachycardia;

/**
 * String-backed enumeration of Sinus Rhythm modifiers.
 */
typedef NSString * ACKDeterminationModifier NS_STRING_ENUM;
extern ACKDeterminationModifier _Nonnull ACKDeterminationModifierNone;
extern ACKDeterminationModifier _Nonnull ACKDeterminationModifierMultiplePACs;
extern ACKDeterminationModifier _Nonnull ACKDeterminationModifierWideQRS;
extern ACKDeterminationModifier _Nonnull ACKDeterminationModifierMultipleVEBs;

/**
 * String-backed enumeration for the device type used for ECG recording.
 */
typedef NSString * ACKDeviceType NS_STRING_ENUM;
extern ACKDeviceType _Nonnull ACKDeviceTypeUnknown;
extern ACKDeviceType _Nonnull ACKDeviceTypeTriangle;
extern ACKDeviceType _Nonnull ACKDeviceTypeMobile;
extern ACKDeviceType _Nonnull ACKDeviceTypeBand;
extern ACKDeviceType _Nonnull ACKDeviceTypeSakuraOne;
extern ACKDeviceType _Nonnull ACKDeviceTypeCard;
extern ACKDeviceType _Nonnull ACKDeviceTypeK1000;
extern ACKDeviceType _Nonnull ACKDeviceTypeK6LMax;
extern ACKDeviceType _Nonnull ACKDeviceTypeTriangleWildCard;
/**
 * Supported UI/localization language codes.
 */
typedef NSString * ACKLanguageType NS_STRING_ENUM;
extern ACKLanguageType _Nonnull ACKLanguageTypeSystem;
extern ACKLanguageType _Nonnull ACKLanguageTypeEnglish;
extern ACKLanguageType _Nonnull ACKLanguageTypeRussian;
extern ACKLanguageType _Nonnull ACKLanguageTypeVietnamese;
extern ACKLanguageType _Nonnull ACKLanguageTypeFinnish;
extern ACKLanguageType _Nonnull ACKLanguageTypePortuguesePortugal;
extern ACKLanguageType _Nonnull ACKLanguageTypeHungarian;
extern ACKLanguageType _Nonnull ACKLanguageTypeCzech;
extern ACKLanguageType _Nonnull ACKLanguageTypeGerman;
extern ACKLanguageType _Nonnull ACKLanguageTypeDutch;
extern ACKLanguageType _Nonnull ACKLanguageTypeFrench;
extern ACKLanguageType _Nonnull ACKLanguageTypeArabic;
extern ACKLanguageType _Nonnull ACKLanguageTypeSwedish;
extern ACKLanguageType _Nonnull ACKLanguageTypeSpanish;
extern ACKLanguageType _Nonnull ACKLanguageTypePortugueseBrazil;
extern ACKLanguageType _Nonnull ACKLanguageTypePolish;
extern ACKLanguageType _Nonnull ACKLanguageTypeNorwegian;
extern ACKLanguageType _Nonnull ACKLanguageTypeKorean;
extern ACKLanguageType _Nonnull ACKLanguageTypeJapanese;
extern ACKLanguageType _Nonnull ACKLanguageTypeItalian;
extern ACKLanguageType _Nonnull ACKLanguageTypeEnglishGB;
extern ACKLanguageType _Nonnull ACKLanguageTypeDanish;
extern ACKLanguageType _Nonnull ACKLanguageTypeChineseTraditional;
extern ACKLanguageType _Nonnull ACKLanguageTypeChineseSimplify;   // Simplified Chinese
extern ACKLanguageType _Nonnull ACKLanguageTypeLithuanian;
extern ACKLanguageType _Nonnull ACKLanguageTypeThai;
extern ACKLanguageType _Nonnull ACKLanguageTypeWelsh;
extern ACKLanguageType _Nonnull ACKLanguageTypeSerbian;
extern ACKLanguageType _Nonnull ACKLanguageTypeHebrew;
extern ACKLanguageType _Nonnull ACKLanguageTypeCroatian;
extern ACKLanguageType _Nonnull ACKLanguageTypeRomanian;
extern ACKLanguageType _Nonnull ACKLanguageTypeBulgarian;
extern ACKLanguageType _Nonnull ACKLanguageTypeSlovak;
extern ACKLanguageType _Nonnull ACKLanguageTypeGreek;
extern ACKLanguageType _Nonnull ACKLanguageTypeMalay;
extern ACKLanguageType _Nonnull ACKLanguageTypeTamil;
extern ACKLanguageType _Nonnull ACKLanguageTypeSpanishUS;

#endif /* ACKTypes_h */
