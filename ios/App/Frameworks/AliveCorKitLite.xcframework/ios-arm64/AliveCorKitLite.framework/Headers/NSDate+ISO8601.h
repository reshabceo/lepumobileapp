//
//  NSDate+ISO8601.h
//  AliveCorKit
//
//  Created by Alex Vlasenko on 12/3/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NSDate (ISO8601)

- (NSString *)ISO8601FromDate;

@end

NS_ASSUME_NONNULL_END
