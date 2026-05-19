package com.monitraq.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.activity.EdgeToEdge;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
import com.monitraq.wellue.WelluePlugin;
import com.monitraq.app.plugins.Bp2Plugin;
import com.monitraq.app.plugins.AliveCorPlugin;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Handle the splash screen transition.
        SplashScreen.installSplashScreen(this);

        // Android 15 Edge-to-Edge compatibility bypass
        EdgeToEdge.enable(this);

        // CRITICAL: Register plugins BEFORE super.onCreate()
        // BridgeActivity creates the bridge in super.onCreate(), so plugins must be
        // added to initialPlugins first
        Log.d(TAG, "MainActivity onCreate - Registering Lepu SDK plugins BEFORE bridge creation");
        Log.d(TAG, "Using Lepu SDK from: https://github.com/viatom-develop/LepuDemo.git");
        Log.d(TAG, "AAR Version: lepu-blepro-1.0.8.aar (supports BP2 device)");

        try {
            initialPlugins.add(WelluePlugin.class);
            Log.d(TAG, "✅ WelluePlugin (LepuSDK) added to initialPlugins");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to add WelluePlugin: " + e.getMessage(), e);
        }

        try {
            initialPlugins.add(Bp2Plugin.class);
            Log.d(TAG, "✅ Bp2Plugin added to initialPlugins");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to add Bp2Plugin: " + e.getMessage(), e);
        }

        try {
            initialPlugins.add(AliveCorPlugin.class);
            Log.d(TAG, "✅ AliveCorPlugin added to initialPlugins");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to add AliveCorPlugin: " + e.getMessage(), e);
        }

        // NOW call super.onCreate() - bridge will be created with our plugins included
        super.onCreate(savedInstanceState);

        Log.d(TAG, "MainActivity onCreate completed - Bridge created with Lepu SDK plugins");

        // Enable WebView debugging
        WebView.setWebContentsDebuggingEnabled(true);

        Log.d(TAG, "WellueSDK plugin registered");
    }

    @Override
    public void onResume() {
        super.onResume();
        Log.d(TAG, "MainActivity onResume called");

        // Ensure runtime permissions are requested on Android 12+
        ensureRuntimePermissions();

        // Auto-trigger WellueSDK initialization on app resume
        // This ensures permissions are requested on first app launch
        this.bridge.getWebView().postDelayed(() -> {
            this.bridge.getWebView().evaluateJavascript(
                    "if (window.wellueSDK && !window.wellueSDK.getInitialized()) { " +
                            "  console.log('Auto-initializing WellueSDK...'); " +
                            "  window.wellueSDK.initialize({}).catch(e => console.error('Auto-init failed:', e)); " +
                            "}",
                    null);
        }, 2000); // Wait 2 seconds for the web context to be ready
    }

    @Override
    public void onPause() {
        super.onPause();
        Log.d(TAG, "MainActivity onPause called");
    }

    @Override
    public void onRestart() {
        super.onRestart();
        Log.d(TAG, "MainActivity onRestart called - this might help debug white screen");
    }

    private void ensureRuntimePermissions() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                boolean scanGranted = ContextCompat.checkSelfPermission(this,
                        Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
                boolean connectGranted = ContextCompat.checkSelfPermission(this,
                        Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
                boolean fineGranted = ContextCompat.checkSelfPermission(this,
                        Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                if (!scanGranted || !connectGranted || !fineGranted) {
                    ActivityCompat.requestPermissions(
                            this,
                            new String[] {
                                    Manifest.permission.BLUETOOTH_SCAN,
                                    Manifest.permission.BLUETOOTH_CONNECT,
                                    Manifest.permission.ACCESS_FINE_LOCATION
                            },
                            1001);
                    Log.d(TAG, "Requested runtime permissions for Bluetooth & Location");
                }
            } else {
                boolean fineGranted = ContextCompat.checkSelfPermission(this,
                        Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                if (!fineGranted) {
                    ActivityCompat.requestPermissions(
                            this,
                            new String[] { Manifest.permission.ACCESS_FINE_LOCATION },
                            1002);
                    Log.d(TAG, "Requested ACCESS_FINE_LOCATION permission (pre-Android 12)");
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "ensureRuntimePermissions error", t);
        }
    }
}
