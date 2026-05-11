//
//  ACLeadPair.h
//  ACKit
//
//  Created by Alex Vlasenko on 10/24/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKConstants.h>

NS_ASSUME_NONNULL_BEGIN

@interface ACLeadPair : NSObject

@property(nonatomic) ACKLeadState first;
@property(nonatomic) ACKLeadState second;
/**
 * Constructor for a Pair.
 *
 * @param first the first object in the Pair
 * @param second the second object in the pair
 */
- (instancetype)initWithFirst:(ACKLeadState)first second:(ACKLeadState)second;

@end

NS_ASSUME_NONNULL_END
