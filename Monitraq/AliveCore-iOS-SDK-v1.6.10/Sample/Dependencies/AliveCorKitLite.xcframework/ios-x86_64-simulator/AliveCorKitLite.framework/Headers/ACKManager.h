//
//  AliveCorKitManager.h
//  AliveCorKitLite
//
//  Created by Alex Vlasenko on 12/19/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//


#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKDevice.h>
#import <AliveCorKitLite/ACKError.h>
#import <AliveCorKitLite/ACKWebLinks.h>

@class ACKConfiguration;

typedef void (^ACKStatusListener)(NSError * _Nullable error, ACKConfiguration *_Nullable config);

NS_ASSUME_NONNULL_BEGIN

/**
 *  SDK entry point for AliveCorKitLite.
 *
 *  @discussion
 *  Initialize this manager early in app launch with your partner API key.
 *  The API key is used to authorize the SDK. Until initialization and
 *  authorization succeed, all interactions with the SDK will fail.
 *
 *  When initialized with isDebugMode = YES, the SDK targets the staging
 *  environment. Callbacks may arrive on a background queue; dispatch to the
 *  main queue before updating UI.
 */
@interface ACKManager : NSObject

/// Semantic version of the SDK (e.g., "1.2.3").
@property (nonatomic, readonly) NSString *version;

/// Optional default language for SDK UI/content.
@property (nonatomic, nullable) ACKLanguageType defaultLanguageType;

/// Internal build number of the SDK.
@property (nonatomic, readonly) NSString *buildNumber;

/// The API key currently used to authorize SDK access.
@property (nonatomic, readonly) NSString *apiKey;

/// Host application name.
@property (nonatomic, readonly) NSString *appName;

/// Absolute path to the directory where recorded ECG files are stored.
@property (nonatomic, readonly) NSString *ecgFilesDirectory;

/// Provisioned configuration and consumer-specific restrictions.
@property (nonatomic, readonly) ACKConfiguration *configuration;

/// Web links used by HUD screens. Assign to customize.
@property (nonatomic) ACKWebLinks *links;

/// Indicates whether the SDK was initialized in debug (staging) mode.
@property (nonatomic, readonly) BOOL isDebugMode;

/// Device types supported per current configuration.
@property (nonatomic, readonly) NSArray<ACKDeviceType> *supportedDevices;

/// Shared singleton instance.
+ (instancetype)sharedInstance;

/**
 *  Initialize the SDK with an API key.
 *
 *  @param apiKey         Partner API key.
 *  @param isDebugMode    YES to use the staging environment.
 *  @param statusListener Completion block invoked once with either a config on
 *                        success or an error on failure. May be called on a
 *                        background queue.
 *
 *  @return The shared instance.
 */
+ (instancetype)initWithApiKey:(NSString *)apiKey isDebugMode:(BOOL)isDebugMode statusListener:(nullable ACKStatusListener)statusListener;

/**
 *  Initialize the SDK with an API key and application name.
 *
 *  @param apiKey         Partner API key.
 *  @param isDebugMode    YES to use the staging environment.
 *  @param appName        Host application name.
 *  @param statusListener Completion block invoked once with either a config on
 *                        success or an error on failure. May be called on a
 *                        background queue.
 *
 *  @return The shared instance.
 */
+ (instancetype)initWithApiKey:(NSString *)apiKey isDebugMode:(BOOL)isDebugMode appName:(NSString *)appName statusListener:(nullable ACKStatusListener)statusListener;

/**
 *  Update the API key (e.g., when a token is refreshed).
 *
 *  @param apiKey New partner API key.
 */
- (void)updateApiKey:(NSString *)apiKey;

/**
 *  Forget the currently paired device and clear persisted pairing data.
 */
- (void)forgetDevice;

/**
 *  Returns the identifier for the currently bundled Kardia AI algorithm package.
 *
 *  @return String representation of the KAI package/version.
 */
- (NSString *)algorithmPackageForCurrentKAI;

/**
 *  Indicates whether Kardia AI v2 is enabled in the current configuration.
 *
 *  @return YES if KAI v2 is enabled.
 */
- (BOOL)isKAIV2enabled;

/**
 *  Delete the stored access token to force a refresh on the next authorized call.
 *
 *  @discussion
 *  Debug-only utility to test host app refresh-token logic.
 */
- (void)deleteAccessToken;

/**
 *  Force a provisioning check against the server.
 *
 *  @param statusListener Completion block invoked with either a config on
 *                        success or an error on failure. May be called on a
 *                        background queue.
 *
 *  @discussion
 *  If authorization fails, an error is returned; on success, the configuration
 *  includes allowed devices and the expiration date of the authorization.
 */
- (void)checkStatusWithListener:(nullable ACKStatusListener)statusListener;

- (instancetype)init NS_UNAVAILABLE;
@end

NS_ASSUME_NONNULL_END
