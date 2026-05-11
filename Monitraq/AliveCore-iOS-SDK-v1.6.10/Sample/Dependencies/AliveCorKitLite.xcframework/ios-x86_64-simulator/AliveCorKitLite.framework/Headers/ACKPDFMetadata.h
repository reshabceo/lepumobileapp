//
//  ACKPDFMetadata.h
//  AliveCorKitExample
//
//  Created by Alex Vlasenko on 4/23/20.
//  Copyright © 2020 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * A model object containing patient information for inclusion in PDF reports.
 *
 * @discussion
 * `ACKPDFMetadata` encapsulates demographic and identifying details associated
 * with an ECG recording. The metadata is displayed in the PDF report header or
 * cover page and may include patient name, age, notes, and other optional data.
 */
@interface ACKPDFMetadata : NSObject

/// The patient’s first name.
@property (nonatomic, copy, nullable) NSString *patientFirstName;

/// The patient’s last name.
@property (nonatomic, copy, nullable) NSString *patientLastName;

/// Additional patient information displayed on the PDF cover page below the name (maximum of two lines).
@property (nonatomic, copy, nullable) NSString *patientInfo;

/// The patient’s date of birth.
@property (nonatomic, copy, nullable) NSString *patientDateOfBirth;

/// The patient’s age.
@property (nonatomic, copy, nullable) NSString *patientAge;

/// Notes associated with the patient or ECG recording.
@property (nonatomic, copy, nullable) NSString *notes;

/// Tags or identifiers related to the patient or ECG record.
@property (nonatomic, copy, nullable) NSString *tags;

/// The patient’s sex. A Boolean value where `YES` indicates male.
@property (nonatomic, copy, nullable) NSNumber *male;

/// Indicates whether the ECG was recorded by a registered user (`YES`) or a guest (`NO`).
@property (nonatomic, copy, nullable) NSNumber *recordedByUser;

/**
 * Compares two `ACKPDFMetadata` objects for equality.
 *
 * @param metadata Another metadata object to compare.
 * @return `YES` if both metadata objects contain the same values; otherwise, `NO`.
 */
- (BOOL)isEqualToACKPDFMetaData:(ACKPDFMetadata *)metadata;

@end

NS_ASSUME_NONNULL_END
