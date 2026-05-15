//
//  ACKKaiProcessor.h
//  AliveCorKit
//
//  Created by Alex Vlasenko on 11/20/19.
//  Copyright © 2019 AliveCor Inc. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@class ACKEcgRecord;
@class ACKError;
@class ACKEcgEvaluation;

typedef void (^ACKKaiProcessorHandler)(ACKEcgRecord *record, ACKError *error);


@interface ACKKaiProcessor : NSObject

+ (void)evaluateEcgRecord:(ACKEcgRecord *)record
             wavAudioPath:(NSString *)wavAudioPath
   electricallyInterfered:(BOOL)electricallyInterfered
         algorithmPackage:(NSString *)algorithmPackage
        completionHandler:(ACKKaiProcessorHandler)completionHandler;

+ (void)runAlgorithmAnalysisForOriginalAtcPath:(NSString *)originalAtcPath
                              algorithmPackage:(NSString *)algorithmPackage
                             completionHandler:(void(^)(ACKEcgEvaluation *evaluation))completionHandler;

@end

NS_ASSUME_NONNULL_END
