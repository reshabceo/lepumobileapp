import UIKit
import Capacitor
import AppTrackingTransparency

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // CRITICAL: Force WellueSDK class to load BEFORE Capacitor initializes
        // This ensures the plugin is available when Capacitor builds its plugin registry
        // Multiple references ensure the class is fully loaded and linked
        
        // Reference 1: Direct class reference
        _ = WellueSDK.self
        
        // Reference 2: Type metadata access
        let pluginType = type(of: WellueSDK.self)
        let _ = String(describing: pluginType)
        
        // Reference 3: Force class initialization by checking if it responds to a method
        // This ensures the class is properly loaded into the runtime
        if WellueSDK.self.responds(to: #selector(WellueSDK.initialize(_:))) {
            // Class is properly loaded
        }
        
        // Note: Safari Web Inspector works automatically in Debug builds
        // No additional code needed - just enable Safari's Develop menu
        
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        
        // App Tracking Transparency: Request permission if tracking is enabled
        // IMPORTANT: Only request tracking authorization if your app actually tracks users across apps/websites
        // If your app only collects crash/performance data for internal use, you should NOT request tracking permission
        // and should update App Store Connect privacy settings to indicate "No" for tracking.
        //
        // If you DO track users (e.g., for advertising), uncomment the code below:
        /*
        if #available(iOS 14, *) {
            // Only request if tracking authorization status is not determined
            if ATTrackingManager.trackingAuthorizationStatus == .notDetermined {
                ATTrackingManager.requestTrackingAuthorization { status in
                    DispatchQueue.main.async {
                        switch status {
                        case .authorized:
                            print("✅ Tracking authorization granted")
                        case .denied:
                            print("❌ Tracking authorization denied")
                        case .restricted:
                            print("⚠️ Tracking authorization restricted")
                        case .notDetermined:
                            print("❓ Tracking authorization not determined")
                        @unknown default:
                            print("❓ Unknown tracking authorization status")
                        }
                    }
                }
            }
        }
        */
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
