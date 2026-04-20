//
//  ACKStub.h
//  AliveCorKitLite
//
//  Created by Oleksandr Vlasenko on 4/5/21.
//  Copyright © 2021 Alex Vlasenko. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, ACKTestCase) {
    ACKTestCaseBatteryReplacement
};

@interface ACKStub : NSObject

- (instancetype)initWithTestCase:(ACKTestCase)testCase;

@property(nonatomic, readonly) ACKTestCase testCase;

@end

NS_ASSUME_NONNULL_END
