//
//  ACKUIConfiguration.h
//  AliveCorKitLite
//
//  Created by Oleksandr Vlasenko on 11/5/20.
//  Copyright © 2020 Alivecor. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 *  To configure application UI appearance. 
 */
@interface ACKUIConfiguration : NSObject

/**
 *  The application's name that need to be displayed instead of the default values.
 */
@property (nonatomic, copy, nullable) NSString *appName;
/**
 *  The bottom image of the triangle on the ECG recording screen for the inactive state.
 */
@property (nonatomic, copy, nullable) UIImage *triangleBottomInactiveImage;
/**
 *  The bottom image of the triangle on the ECG recording screen for the active state.
 */
@property (nonatomic, copy, nullable) UIImage *triangleBottomActiveImage;
/**
 *  The image of the triangle on the ECG recording screen for the inactive state.
 */
@property (nonatomic, copy, nullable) UIImage *triangleInactiveImage;
/**
 *  The image of the triangle on the ECG recording screen for the active state.
 */
@property (nonatomic, copy, nullable) UIImage *triangleActiveImage;
/**
 *  The image of the uncharged battery on the ECG recording screen.
 */
@property (nonatomic, copy, nullable) UIImage *unchargedBatteryImage;
/**
 *  The alias for the 6L device.
 */
@property (nonatomic, copy, nullable) NSString *kardiaMobile6LAlias;

@end

NS_ASSUME_NONNULL_END
