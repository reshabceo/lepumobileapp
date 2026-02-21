//
//  UIImage+Bundle.h
//  AliveCorKitExample
//
//  Created by Alex Vlasenko on 12/16/19.
////  Copyright © 2019 AliveCor Inc. All rights reserved.
//


#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/// > Warning: AliveCorKitLite internal.
@interface UIImage (Bundle)

+ (nullable UIImage *)ack_imageNamed:(NSString *)name;

@end

NS_ASSUME_NONNULL_END
