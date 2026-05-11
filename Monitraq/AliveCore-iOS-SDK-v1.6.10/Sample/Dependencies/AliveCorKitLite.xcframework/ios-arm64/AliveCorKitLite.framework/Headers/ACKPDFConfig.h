//
//  ACKPDFConfig.h
//  AliveCorKitExample
//
//  Created by Alex Vlasenko on 4/24/20.
//  Copyright © 2020 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKTypes.h>

NS_ASSUME_NONNULL_BEGIN

@class ACKEcgRecord;
@class ACKPDFMetadata;
@class ACKPDFDisplaySettings;

/**
 * A configuration object that defines what data should appear in a generated PDF report
 * and how that data is presented.
 *
 * @discussion
 * `ACKPDFConfig` encapsulates all the necessary information for building a PDF report,
 * including the ECG record, patient metadata, filter settings, and display preferences.
 */
@interface ACKPDFConfig : NSObject

/**
 * The ECG record to be displayed in the PDF report.
 */
@property (nonatomic, copy, nullable) ACKEcgRecord *ecgRecord;

/**
 * The metadata associated with the ECG record, such as patient and measurement details.
 */
@property (nonatomic, copy, nullable) ACKPDFMetadata *metadata;

/**
 * The filter type applied when rendering the ECG in the PDF.
 */
@property (nonatomic) ACKFilterType filterType;

/**
 * The display settings that control layout, grid style, and other rendering options.
 */
@property (nonatomic, copy, nullable, readonly) ACKPDFDisplaySettings *displaySettings;

/**
 * Creates a new PDF configuration for the specified ECG record.
 *
 * @param ecgRecord The ECG record for which the PDF report should be generated.
 * @return A fully initialized `ACKPDFConfig` instance.
 */
- (instancetype)initWithEcg:(ACKEcgRecord *)ecgRecord;

/// Unavailable. Use `initWithEcg:` instead.
- (instancetype)init NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END
