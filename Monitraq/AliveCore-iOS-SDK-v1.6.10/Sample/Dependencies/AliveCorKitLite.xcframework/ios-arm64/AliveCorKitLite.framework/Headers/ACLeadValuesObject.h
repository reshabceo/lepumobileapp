//
//  ACLeadValuesObject.h
//  ACKit
//
//  Created by Alex Vlasenko on 10/29/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "ECGData.h"

NS_ASSUME_NONNULL_BEGIN

@interface ACLeadValuesObject : NSObject

@property(nonatomic) struct ECGFrame frame;

- (instancetype)initWithFrame:(struct ECGFrame)frame;

@end

NS_ASSUME_NONNULL_END
