package com.priti.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.priti.wellue.WelluePlugin;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "MainActivity";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WelluePlugin.class);
        super.onCreate(savedInstanceState);

        Log.d(TAG, "MainActivity onCreate called");

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
                null
            );
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
                boolean scanGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
                boolean connectGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
                boolean fineGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                if (!scanGranted || !connectGranted || !fineGranted) {
                    ActivityCompat.requestPermissions(
                        this,
                        new String[]{
                            Manifest.permission.BLUETOOTH_SCAN,
                            Manifest.permission.BLUETOOTH_CONNECT,
                            Manifest.permission.ACCESS_FINE_LOCATION
                        },
                        1001
                    );
                    Log.d(TAG, "Requested runtime permissions for Bluetooth & Location");
                }
            } else {
                boolean fineGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                if (!fineGranted) {
                    ActivityCompat.requestPermissions(
                        this,
                        new String[]{ Manifest.permission.ACCESS_FINE_LOCATION },
                        1002
                    );
                    Log.d(TAG, "Requested ACCESS_FINE_LOCATION permission (pre-Android 12)");
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "ensureRuntimePermissions error", t);
        }
    }
}
