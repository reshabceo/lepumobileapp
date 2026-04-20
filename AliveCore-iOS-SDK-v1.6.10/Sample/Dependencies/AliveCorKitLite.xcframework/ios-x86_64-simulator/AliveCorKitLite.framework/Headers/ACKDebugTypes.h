//
//  ACKDebugTypes.h
//  AliveCorKit
//
//  Created by Oleksandr Vlasenko on 11/30/20.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#ifndef ACKDebugTypes_h
#define ACKDebugTypes_h
#import <AliveCorKitLite/ACKTypes.h>

/**
 *  The filter type that will be applied to the ECG recording.
 */
typedef NS_ENUM(NSInteger, ACKDebugFilterType) {
    ACKFilterTypeNone = ACKFilterTypeOriginal + 1,
    ACKFilterTypeNotch
};


#endif /* ACKDebugTypes_h */
