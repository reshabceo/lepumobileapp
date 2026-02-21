//
//  UIDevice+ACHardware.h
//  AliveECG
//
//  Created by Kim Barnett on 13/12/10.
//  Copyright 2010 AliveCor Inc. All rights reserved.
//

#import <UIKit/UIKit.h>

@interface UIDevice(ACHardware)
+ (NSString *)platformIdentifier;
+ (NSString *)platformString;
+ (BOOL)isIPad;
+ (NSString *)phoneModel;
@end
