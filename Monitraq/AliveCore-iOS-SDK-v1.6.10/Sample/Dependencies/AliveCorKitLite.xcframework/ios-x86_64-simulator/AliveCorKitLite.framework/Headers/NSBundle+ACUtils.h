//
//  NSBundle+ACUtils.h
//  AliveCorKit
//
//  Created by Alex Vlasenko on 12/4/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

#define ACKLocalizedStringFromAssetsBundle(key, comment) \
    [NSBundle ack_localizedStringForKey:(key) cmmt:(comment)]
#define ACKLocalizedStringFromAssetsBundleWithLanguage(key, comment, lang) \
    [NSBundle ack_localizedStringForKey:(key) cmmt:(comment) language: (lang)]

@interface NSBundle (ACUtils)

+ (NSString *)ack_appVersion;
+ (NSString *)ack_localizedStringForKey:(NSString *)key cmmt:(nullable NSString *)comment;
+ (NSString *)ack_localizedStringForKey:(NSString *)key cmmt:(nullable NSString *)comment language:(nullable NSString *)language;

@end

NS_ASSUME_NONNULL_END
