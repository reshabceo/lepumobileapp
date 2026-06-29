//
//  ACCurrentDeviceStore.h
//  AliveECG
//
//  Created by Jim Qin on 9/9/18.
//  Copyright © 2018 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AliveCorKitLite/ACKEcgRecordingConfig.h>
#import <AliveCorKitLite/ACKDevice.h>
NS_ASSUME_NONNULL_BEGIN

extern NSString * const ACCurrentDeviceTriangleUUIDNone;
extern NSString * const ACCurrentDeviceK1000UUIDNone;
extern NSString * const ACCurrentDeviceK6LMaxUUIDNone;
extern NSString * const ACCurrentDeviceCardUUIDNone;
extern NSString * const ACCurrentDeviceMobileUUIDNone;
extern NSString * const ACCurrentDeviceBandUUIDNone;
extern NSString * const ACCurrentDeviceSakuraOneUUIDNone;
extern NSString * const ACCurrentDeviceTriangleWildCardUUIDNone;


extern NSString * const ACCurrentDeviceNameTriangle;
extern NSString * const ACCurrentDeviceNameK1000;
extern NSString * const ACCurrentDeviceNameK6LMax;
extern NSString * const ACCurrentDeviceNameCard;
extern NSString * const ACCurrentDeviceNameMobile;
extern NSString * const ACCurrentDeviceNameBand;
extern NSString * const ACCurrentDeviceNameSakuraOne;
extern NSString * const ACCurrentDeviceNameTriangleWildCard;
extern NSString * const ACCurrentDeviceNameUnknown;




typedef NS_ENUM(NSInteger, ACCurrentDeviceLead) {
    ACCurrentDeviceLeadSingle,
    ACCurrentDeviceLeadDual
};

// The device that the user selects as their preferred recording device.
// The device will be setup and ready to record in the record screen.
/**
 * > Warning: AliveCorKitLite internal.
 */
@interface ACCurrentDevice : NSObject

@property (nonatomic, readwrite) ACCurrentDeviceLead preferredLead;
@property (nonatomic, readonly) ACKDeviceType source;
@property (nonatomic, readonly) NSString *uniqueId;
@property (nonatomic, readonly) NSString *name;
//@property (nonatomic, readonly) BOOL exemptFromUnlock;

// The uniqueID for Mobile, Band, and Tripod is set to the UUIDNone string above
// because every one of these devices are indistinguishable from a connection
// point of view. Triangle, however, supports a real device UUID because each
// Triangle can be distinguished and thus only connections from that Triangle
// can be isolated and used for recording purposes. The Triangle's default
// UUID should be set to ACCurrentDeviceTriangleUUIDNone;
+ (instancetype)deviceTriangleWithUniqueId:(NSString *)uniqueID;
+ (instancetype)deviceCardWithUniqueId:(NSString *)uniqueID;
+ (instancetype)deviceK1000WithUniqueId:(NSString *)uniqueID;
+ (instancetype)deviceK6LMaxWithUniqueId:(NSString *)uniqueID;
+ (instancetype)deviceMobile;
+ (instancetype)deviceBand;
+ (instancetype)deviceSakuraOne;

+ (ACKDeviceType)sourceForDeviceName:(NSString *)name;
+ (NSString *)deviceNameForSource:(ACKDeviceType)source;

@end

// Persistence for the current recording device info.
/**
 * > Warning: AliveCorKitLite internal.
 */
@interface ACCurrentDeviceStore : NSObject

+ (void)setDevice:(ACCurrentDevice *)device;
+ (nullable ACCurrentDevice *)fetchDevice;
+ (void)clearStore;

+ (void)setACKDevice:(ACKDevice *)device;
+ (nullable ACKDevice *)fetchACKDevice;
+ (void)clearACKDeviceStore;
+ (void)setLeadsConfig:(ACKLeadsConfig)leadsConfig;
+ (ACKLeadsConfig)fetchLeadsConfigForDeviceType:(ACKDeviceType)deviceType;

+ (void)resetForBleACKDeviceType:(ACKDeviceType)deviceType;
+ (void)confirmForBleACKDeviceType:(ACKDeviceType)deviceType uuid:(NSString *)uuid;

@end

NS_ASSUME_NONNULL_END
