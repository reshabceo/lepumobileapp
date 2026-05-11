//
//  ACKPDFDisplaySettings.h
//  AliveCorKitLite
//
//  Created by Oleksandr Vlasenko on 11/9/20.
//  Copyright © 2020 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKTypes.h>

typedef NSString* ACKPaperSize NS_STRING_ENUM;
extern ACKPaperSize const _Nonnull ACKPaperSizeA4;
extern ACKPaperSize const _Nonnull ACKPaperSizeLetter;

NS_ASSUME_NONNULL_BEGIN

/**
 *  This class contains various display settings to generate PDF reports.
 */
@interface ACKPDFDisplaySettings : NSObject

/**
 *  The filter type that should be applied for the ECG record. By default, filterType is equal to ACKFilterTypeEnhanced.
 */
@property (nonatomic) ACKFilterType filterType;
/**
 *  The paper size that would be applied for the PDF report. By default, paperSize is equal to ACKPaperSizeA4
 */
@property (nonatomic, copy) ACKPaperSize paperSize;
/**
 *  The xScale for the pdf report. By default, xScale = 100
 */
@property (nonatomic) NSInteger xScale;
/**
 *  The yScale for the pdf report. By default yScale = 100
 */
@property (nonatomic) NSInteger yScale;
/**
 *  logo on each page including the cover page.
 */
@property (nonatomic, copy, nullable) NSString *logoName;

/**
 *  footer logo on the cover page.
 */
@property (nonatomic, copy, nullable) NSString *coverPageFooterLogoName;

/**
 *  The filename that would be assigned to the PDF report. By default, the name is equal to "ECG-<uuid>.pdf".
 */
@property (nonatomic, copy, nullable) NSString *fileName;

/**
 *  If YES, the footer of the PDF will contains the recording info: Recorded software and unique identifier of the ECG.
 */
@property (nonatomic) BOOL isFooterWithRecordingInfo;

@property (nonatomic, nullable) ACKLanguageType languageType;

@end

NS_ASSUME_NONNULL_END
