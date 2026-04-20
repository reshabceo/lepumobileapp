package com.monitraq.mobile;

import android.app.Application;
import android.util.Log;

// Prefer reflection to avoid Kotlin Companion API mismatch across SDK versions

public class MainApplication extends Application {
    private static final String TAG = "MainApplication";

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "MainApplication onCreate - Initializing Lepu SDK BleServiceHelper");
        Log.d(TAG, "SDK Source: https://github.com/viatom-develop/LepuDemo.git");
        Log.d(TAG, "AAR Version: lepu-blepro-1.0.8.aar (supports BP2 device)");

        try {
            // Initialize BleServiceHelper as per official Lepu SDK documentation
            // SDK docs: initService(application) - Only need to initService once during app
            // operation
            Class<?> helper = Class.forName("com.lepu.blepro.ext.BleServiceHelper");

            // Access singleton via Companion (Kotlin object pattern)
            Object companion = helper.getField("Companion").get(null);
            try {
                companion.getClass().getMethod("initService", Application.class).invoke(companion, this);
                Log.d(TAG, "✅ BleServiceHelper initialized via Companion.initService()");
            } catch (NoSuchMethodException ex) {
                // Fallback to instance method if Companion pattern doesn't work
                Log.d(TAG, "⚠️ Companion.initService() not found, trying instance method...");
                Object instance = helper.getDeclaredConstructor().newInstance();
                helper.getMethod("initService", Application.class).invoke(instance, this);
                Log.d(TAG, "✅ BleServiceHelper initialized via instance.initService()");
            }

            // Verify initialization - SDK will send EventServiceConnectedAndInterfaceInit
            // when ready
            Log.d(TAG, "✅ Lepu SDK BleServiceHelper initialization completed");
            Log.d(TAG, "📡 Waiting for SDK service ready event: EventServiceConnectedAndInterfaceInit");

        } catch (ClassNotFoundException e) {
            Log.e(TAG,
                    "❌ CRITICAL: BleServiceHelper class not found - AAR file may be missing or not properly included");
            Log.e(TAG, "   Expected AAR: android/app/libs/lepu-blepro-1.0.8.aar");
            Log.e(TAG, "   Please verify the AAR file exists and build.gradle includes it");
        } catch (Throwable t) {
            Log.e(TAG, "❌ Failed to initialize BleServiceHelper: " + t.getMessage(), t);
            Log.e(TAG, "   This will prevent BP2 device connections");
        }
    }
}
