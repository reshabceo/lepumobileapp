//
//  ACKRecordingTraceView.h
//  AliveCorKitLite
//
//  Created by Alex Vlasenko on 10/28/20.
//  Copyright © 2020 AliveCor Inc. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <AliveCorKitLite/ACKTypes.h>

@class ACKEcgFileView;
@class ACKEcgRecord;

/**
 *  A view that displays ECG recording chart.
 */
@interface ACKEcgRecordingTraceView : UIView

/**
 *  Hide/Show scale label on the view instance.
 */
@property (nonatomic) BOOL isScaleLabelHidden;
/**
 *  Hide/Show scale lead labels on the view instance.
 */
@property (nonatomic) BOOL isLeadLabelsHidden;
/**
 *  Enable/Disable scrolling
 */
@property (nonatomic) BOOL isScrollable;

/**
 *  Initializes object with the results of the ECG recording.
 *
 *  @param  ecg The instance of the ECG recording.
 *  @return class instance
 */
- (instancetype)initWithEcg:(ACKEcgRecord *)ecg;

/**
 *  Inverts the ECG chart.
 */
- (void)invertEcgChart;

@end
