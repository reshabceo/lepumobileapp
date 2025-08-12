package com.priti.app;

import android.app.Application;
import android.util.Log;

// Prefer reflection to avoid Kotlin Companion API mismatch across SDK versions

public class MainApplication extends Application {
    private static final String TAG = "MainApplication";

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            Class<?> helper = Class.forName("com.lepu.blepro.ext.BleServiceHelper");
            // Access singleton via Companion or static accessor
            Object companion = helper.getField("Companion").get(null);
            try {
                companion.getClass().getMethod("initService", Application.class).invoke(companion, this);
            } catch (NoSuchMethodException ex) {
                // Fallback to instance method path if needed
                Object instance = helper.getDeclaredConstructor().newInstance();
                helper.getMethod("initService", Application.class).invoke(instance, this);
            }
            Log.d(TAG, "BleServiceHelper initialized via reflection");
        } catch (Throwable t) {
            Log.e(TAG, "Failed to init BleServiceHelper", t);
        }
    }
}


