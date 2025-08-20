package com.priti.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "MainActivity";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Log.d(TAG, "MainActivity onCreate called");

        // Enable WebView debugging
        WebView.setWebContentsDebuggingEnabled(true);
    }
    
    @Override
    public void onResume() {
        super.onResume();
        Log.d(TAG, "MainActivity onResume called");
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
}
