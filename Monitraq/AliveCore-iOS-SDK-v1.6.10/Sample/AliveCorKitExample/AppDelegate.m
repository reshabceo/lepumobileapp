//
//  AppDelegate.m
//  AliveCorKitExample
//
//  Copyright © 2021 Alivecor. All rights reserved.
//

#import "AppDelegate.h"
#import "AliveCorKitExample-Swift.h"

@interface AppDelegate ()

@end

@implementation AppDelegate


- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    
    NSLog(@"ACKit version: %@", [ACKManager.sharedInstance version]);

    self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
    self.window.rootViewController = [[NavigationController alloc] initWithRootViewController:[[MainViewController alloc] init]];

    [self.window makeKeyAndVisible];

    return YES;
}


@end
