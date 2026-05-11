package com.monitraq.mobile.plugins;

import android.content.Intent;
import android.util.Log;
import android.app.Activity;
import androidx.activity.result.ActivityResult;
import com.alivecor.api.AliveCorDevice;
import com.alivecor.api.AliveCorKit;
import com.alivecor.api.InitListener;
import com.alivecor.ecg.record.RecordActivityResult;
import com.alivecor.api.AliveCorEcg;
import com.alivecor.api.EcgEvaluation;
import com.alivecor.api.RecordingConfiguration;
import com.alivecor.atc.ATCReader;
import com.alivecor.ecgcore.ECGLead;
import com.alivecor.ecgcore.ECGSignal;
import com.alivecor.ecg.record.RecordEkgConfig;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import java.util.ArrayList;
import java.util.List;
import android.os.Handler;
import android.os.Looper;

@CapacitorPlugin(name = "AliveCorSDK", permissions = {
    @Permission(
        alias = "bluetooth",
        strings = {
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.ACCESS_FINE_LOCATION
        }
    ),
    @Permission(
        alias = "audio",
        strings = { Manifest.permission.RECORD_AUDIO }
    )
})
public class AliveCorPlugin extends Plugin {
    private static final String TAG = "AliveCorPlugin";
    private static final String PREF_NAME = "AliveCorPrefs";
    private static final String KEY_PAIRED_DEVICE = "paired_device_id";
    private static final String KEY_BATTERY = "last_battery";
    private static final int REQUEST_RECORDING = 1234;
    
    private BluetoothLeScanner scanner;
    private ScanCallback scanCallback;
    private String pairedDeviceId = null;
    private final Handler handler = new Handler(Looper.getMainLooper());
    // Track SDK init state ourselves – AliveCorKit.get() throws if not initialized
    private static boolean sdkInitialized = false;
    private static boolean isInitializing = false;

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "AliveCorPlugin loaded for bundle: " + getContext().getPackageName());
        // Load paired device from storage
        android.content.SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, android.content.Context.MODE_PRIVATE);
        pairedDeviceId = prefs.getString(KEY_PAIRED_DEVICE, null);
    }

    /** Returns true if AliveCorKit singleton is completely and successfully initialized. */
    private boolean isKitReady() {
        return sdkInitialized;
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        String jwt = call.getString("jwt");
        boolean isDebug = call.getBoolean("isDebugMode", false);
        String bundleId = call.getString("bundleId", getContext().getPackageName());

        if (jwt == null) {
            call.reject("JWT is required for initialization");
            return;
        }

        Log.d(TAG, "initialize() called with JWT: " + jwt.substring(0, Math.min(jwt.length(), 15)) + "...");

        // If already initialized, resolve immediately — re-calling initialize() may swallow callbacks
        if (isKitReady()) {
            Log.d(TAG, "AliveCorKit already initialized, skipping re-init");
            call.resolve();
            return;
        }

        if (isInitializing) {
            Log.w(TAG, "SDK is already initializing, please wait...");
            call.reject("SDK is already initializing");
            return;
        }

        isInitializing = true;

        try {
            AliveCorKit.initialize(
                getContext(),
                jwt,
                new InitListener() {
                    @Override
                    public void onInitComplete() {
                        Log.d(TAG, "AliveCor SDK Initialized successfully");
                        sdkInitialized = true;
                        isInitializing = false;
                        call.resolve();
                    }

                    @Override
                    public void onInitError(Throwable throwable) {
                        Log.e(TAG, "AliveCor SDK Initialization failed", throwable);
                        sdkInitialized = false;
                        isInitializing = false;
                        call.reject("Initialization failed: " + throwable.getMessage());
                    }
                },
                bundleId,
                "Monitraq Mobile",
                "1.0.0",
                isDebug
            );
        } catch (Exception e) {
            Log.e(TAG, "AliveCorKit.initialize() threw: " + e.getMessage());
            call.reject("Failed to initialize: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startSixLeadRecording(final PluginCall call) {
        final String jwt = call.getString("jwt");
        final String leadConfig = call.getString("leadConfig", "six");
        final String patientId = call.getString("patientId", "monitraq_patient");
        final boolean isDebug = call.getBoolean("isDebugMode", false);
        final String bundleId = call.getString("bundleId", getContext().getPackageName());

        // K6LMAX is the correct enum for KardiaMobile 6L in this SDK build (confirmed via javap decompilation)
        final AliveCorDevice device = "single".equalsIgnoreCase(leadConfig) ?
            AliveCorDevice.KARDIA_MOBILE : AliveCorDevice.K6LMAX;

        Log.d(TAG, "startSixLeadRecording called – device=" + device + ", patientId=" + patientId);

        // ── Inner action: launch AliveCor SDK recording Activity ──────────────
        Runnable startRecordingAction = () -> {
            try {
                // Ensure all background scans are stopped before launching the SDK activity
                stopScan(null);

                // Use TRIANGLE for KardiaMobile 6L (as seen in official test app)
                com.alivecor.api.AliveCorDevice activeDevice = com.alivecor.api.AliveCorDevice.TRIANGLE;

                Log.d(TAG, "Launching AliveCor recording intent with TRIANGLE device and patientId: " + patientId);
                Intent intent = AliveCorKit.get().getRecordIntent(activeDevice, patientId);
                
                // Allow the user to select/change device if needed (triggers discovery UI)
                intent.putExtra(com.alivecor.ecg.record.RecordEkgConstants.EXTRA_PROMPT_DEVICE, true);
                
                // CRITICAL: Set 6-lead configuration and other required extras
                intent.putExtra(com.alivecor.ecg.record.RecordEkgConstants.EXTRA_LEADS_CONFIG, com.alivecor.api.LeadConfiguration.SIX.name());
                intent.putExtra(com.alivecor.ecg.record.RecordEkgConstants.EXTRA_FILTER_TYPE, "ENHANCED");
                intent.putExtra(com.alivecor.ecg.record.RecordEkgConstants.EXTRA_MAX_DURATION, 30); // 30 seconds
                intent.putExtra(com.alivecor.ecg.record.RecordEkgConstants.EXTRA_ENABLE_LEADS_BUTTONS, true);

                Activity activity = getActivity();
                if (activity == null || activity.isFinishing()) {
                    Log.e(TAG, "Activity is null or finishing");
                    call.reject("Activity is not available");
                    return;
                }
                saveCall(call);
                Log.d(TAG, "Starting AliveCor recording activity (REQUEST_CODE=" + REQUEST_RECORDING + ")");
                activity.startActivityForResult(intent, REQUEST_RECORDING);
            } catch (Exception e) {
                Log.e(TAG, "Failed to launch recording intent: " + e.getMessage(), e);
                call.reject("Failed to start recording: " + e.getMessage());
            }
        };

        // ── ✅ FIX: Don't re-initialize if SDK is already running ─────────────
        // Re-calling AliveCorKit.initialize() when already initialized may silently
        // swallow the InitListener callbacks, causing the call to hang forever.
        if (isKitReady()) {
            Log.d(TAG, "AliveCorKit already initialized — launching recording directly");
            startRecordingAction.run();
            return;
        }

        // SDK not yet initialized — need a JWT
        if (jwt == null || jwt.isEmpty()) {
            call.reject("JWT is required to initialize the AliveCor SDK");
            return;
        }

        if (isInitializing) {
            Log.w(TAG, "SDK is already initializing, please wait...");
            call.reject("SDK is already initializing");
            return;
        }

        isInitializing = true;
        String environment = call.getString("environment", "sandbox");
        com.alivecor.pro.AliveCorServer server = "production".equalsIgnoreCase(environment) ?
            com.alivecor.pro.AliveCorServer.PRODUCTION_US :
            com.alivecor.pro.AliveCorServer.STAGING_US;

        Log.d(TAG, "Initializing AliveCorKit before recording with JWT: " + jwt.substring(0, Math.min(jwt.length(), 15)) + "... (env: " + environment + ")");
        try {
            AliveCorKit.initialize(
                getContext(),
                jwt,
                new InitListener() {
                    @Override
                    public void onInitComplete() {
                        Log.d(TAG, "AliveCorKit init complete — starting recording");
                        sdkInitialized = true;
                        isInitializing = false;
                        getActivity().runOnUiThread(() -> {
                            startRecordingAction.run();
                        });
                    }

                    @Override
                    public void onInitError(Throwable throwable) {
                        Log.e(TAG, "AliveCorKit init error: " + throwable.getMessage(), throwable);
                        sdkInitialized = false;
                        isInitializing = false;
                        call.reject("SDK initialization failed. Please check your internet and patient ID. Error: " + throwable.getMessage());
                    }
                },
                bundleId,
                "Monitraq Mobile",
                "1.0.0",
                server,
                isDebug
            );
        } catch (Exception e) {
            // AliveCorKit.initialize() can throw if called while already initializing
            Log.e(TAG, "initialize() threw: " + e.getMessage(), e);
            isInitializing = false;
            call.reject("SDK initialization failed internally: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_RECORDING) return;

        PluginCall call = getSavedCall();
        if (call == null) {
            Log.e(TAG, "No saved call found in onActivityResult");
            return;
        }

        try {
            if (resultCode == Activity.RESULT_OK && data != null) {
                RecordActivityResult recordResult = AliveCorKit.get().getRecordActivityResult(data);
                if (recordResult != null && recordResult.getSuccessfulResult() != null) {
                    AliveCorEcg ecg = recordResult.getSuccessfulResult();
                    EcgEvaluation eval = ecg.getEcgEvaluation();
                    RecordingConfiguration config = ecg.getRecordingConfiguration();

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("heartRate", eval != null ? eval.getAverageHeartRate() : 0);
                    ret.put("diagnosisText", eval != null && eval.getAlgorithmResultText() != null ? eval.getAlgorithmResultText().toString() : "Normal");
                    ret.put("determination", eval != null ? eval.getDetermination().name() : "UNKNOWN");
                    ret.put("sampleRate", config != null ? config.getSampleRate() : 300);
                    ret.put("durationSeconds", (double) ecg.getDurationMs() / 1000.0);
                    ret.put("deviceType", ecg.getDeviceInfo() != null ? ecg.getDeviceInfo().getDevice().name() : "KardiaMobile 6L");
                    ret.put("isInverted", eval != null && eval.isInverted());

                    if (ecg.getDeviceInfo() != null) {
                        float battery = ecg.getDeviceInfo().getBatteryLevel() != null ? ecg.getDeviceInfo().getBatteryLevel() : -1;
                        ret.put("batteryLevel", battery);
                        ret.put("serialNumber", ecg.getDeviceInfo().getSerialNumber());
                        
                        // Save battery level
                        android.content.SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, android.content.Context.MODE_PRIVATE);
                        prefs.edit().putFloat(KEY_BATTERY, battery).apply();
                    }

                    // Extract Waveform Data from ATC file
                    String atcPath = ecg.getEnhancedAtcPath();
                    if (atcPath != null) {
                        try {
                            ATCReader reader = new ATCReader(atcPath);
                            if (reader.readSucceeded()) {
                                JSObject leads = new JSObject();
                                ECGLead[] leadTypes = {
                                    ECGLead.LEAD_I, ECGLead.LEAD_II, ECGLead.LEAD_III,
                                    ECGLead.LEAD_AVR, ECGLead.LEAD_AVL, ECGLead.LEAD_AVF
                                };
                                String[] leadNames = {"I", "II", "III", "aVR", "aVL", "aVF"};

                                for (int i = 0; i < leadTypes.length; i++) {
                                    ECGSignal signal = reader.getECGSamples(leadTypes[i]);
                                    if (signal != null) {
                                        double[] samples = signal.getMVSamples();
                                        JSArray jsSamples = new JSArray();
                                        for (double s : samples) {
                                            jsSamples.put(s);
                                        }
                                        leads.put(leadNames[i], jsSamples);
                                    }
                                }
                                ret.put("waveformLeads", leads);
                            }
                        } catch (Exception atcErr) {
                            Log.e(TAG, "Failed to read ATC file", atcErr);
                        }
                    }

                    call.resolve(ret);
                } else {
                    call.reject("Recording cancelled or failed");
                }
            } else {
                call.reject("Recording cancelled by user");
            }
        } catch (Exception e) {
            call.reject("Error processing recording result: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDeviceStatus(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        boolean btEnabled = adapter != null && adapter.isEnabled();

        android.content.SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, android.content.Context.MODE_PRIVATE);
        float battery = prefs.getFloat(KEY_BATTERY, -1);

        JSObject result = new JSObject();
        result.put("connected", pairedDeviceId != null && btEnabled);
        result.put("ready", btEnabled);
        result.put("deviceName", pairedDeviceId != null ? "KardiaMobile 6L" : "");
        result.put("deviceId", pairedDeviceId);
        result.put("bluetoothEnabled", btEnabled);
        result.put("batteryLevel", battery > 0 ? battery : null);
        
        String statusText = "Disconnected";
        if (btEnabled) {
            statusText = pairedDeviceId != null ? "Connected" : "Ready to Pair";
        }
        result.put("statusText", statusText);
        
        call.resolve(result);
    }

    @PluginMethod
    public void startScan(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Bluetooth is disabled");
            return;
        }

        scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) {
            call.reject("BLE Scanner not available");
            return;
        }

        scanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                String name = null;
                try {
                    // Android 12+ requires BLUETOOTH_CONNECT for getName()
                    name = result.getDevice().getName();
                } catch (SecurityException e) {
                    Log.e(TAG, "Missing BLUETOOTH_CONNECT permission to get device name", e);
                }

                if (name != null && (name.contains("Kardia") || name.contains("K6L"))) {
                    JSObject dev = new JSObject();
                    dev.put("deviceName", name);
                    dev.put("deviceId", result.getDevice().getAddress());
                    dev.put("rssi", result.getRssi());
                    notifyListeners("deviceFound", dev);
                }
            }
        };

        ScanSettings settings = new ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build();

        scanner.startScan(null, settings, scanCallback);
        
        // Auto-stop after 10 seconds
        handler.postDelayed(() -> stopScan(null), 10000);
        
        call.resolve();
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        if (scanner != null && scanCallback != null) {
            scanner.stopScan(scanCallback);
            scanner = null;
            scanCallback = null;
        }
        if (call != null) call.resolve();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String deviceId = call.getString("deviceId");
        if (deviceId == null) {
            call.reject("Device ID is required");
            return;
        }

        // Persist pairing
        pairedDeviceId = deviceId;
        android.content.SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, android.content.Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_PAIRED_DEVICE, deviceId).apply();
        
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("deviceId", deviceId);
        result.put("deviceName", "KardiaMobile 6L");
        
        notifyListeners("deviceConnected", result);
        call.resolve(result);
    }

    @PluginMethod
    public void dispose(PluginCall call) {
        stopScan(null);
        call.resolve();
    }
}
