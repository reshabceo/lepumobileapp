import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        
        print("🔧 [ViewController] Registering custom local Capacitor plugins...")
        
        // Programmatically register local plugins for Capacitor 6 compatibility
        if #available(iOS 15.0, *) {
            bridge?.registerPluginInstance(IAPPlugin())
        }
        bridge?.registerPluginInstance(AliveCorSDK())
        bridge?.registerPluginInstance(WellueSDK())
        bridge?.registerPluginInstance(CameraBridgePlugin())
        
        print("🔧 [ViewController] Plugins registered successfully: IAPPlugin, AliveCorSDK, WellueSDK, CameraBridgePlugin")
    }
}
