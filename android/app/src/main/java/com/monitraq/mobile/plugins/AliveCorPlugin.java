package com.monitraq.mobile.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * AliveCorPlugin stub — AliveCor SDK has been removed from the Android build.
 * All methods return an "unavailable" error so the app compiles cleanly and
 * gracefully handles missing ECG hardware on Android.
 */
@CapacitorPlugin(name = "AliveCor")
public class AliveCorPlugin extends Plugin {

    @PluginMethod
    public void initialize(PluginCall call) {
        call.reject("AliveCor SDK not available on this build");
    }

    @PluginMethod
    public void startRecording(PluginCall call) {
        call.reject("AliveCor SDK not available on this build");
    }

    @PluginMethod
    public void getDeviceStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("connected", false);
        result.put("deviceName", "");
        result.put("deviceType", "UNAVAILABLE");
        call.resolve(result);
    }

    @PluginMethod
    public void dispose(PluginCall call) {
        call.resolve();
    }
}
