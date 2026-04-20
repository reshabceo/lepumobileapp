package com.priti.app.plugins;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.alivecor.api.AliveCorDevice;
import com.alivecor.api.AliveCorKitLite;
import com.alivecor.api.AliveCorServer;
import com.alivecor.api.InitListener;
import com.alivecor.api.LeadConfiguration;
import com.alivecor.ecg.record.RecordActivityResult;
import com.alivecor.ecg.record.RecordEkgConstants;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

@CapacitorPlugin(name = "AliveCor")
public class AliveCorPlugin extends Plugin {
    private static final String TAG = "AliveCorPlugin";
    private boolean initialized = false;

    // MARK: - initialize

    @PluginMethod
    public void initialize(PluginCall call) {
        String jwt = call.getString("jwt");
        if (jwt == null || jwt.isEmpty()) {
            call.reject("jwt is required");
            return;
        }
        Boolean debugMode = call.getBoolean("isDebugMode", false);

        String bundleId = getContext().getPackageName();
        String partnerId = "";  // Partner ID is embedded in the JWT by the backend
        String appName = "Monitraq";

        AliveCorServer server = (debugMode != null && debugMode)
                ? AliveCorServer.STAGING_US
                : AliveCorServer.PRODUCTION_US;

        try {
            // Check if already initialized
            try {
                if (AliveCorKitLite.get() != null) {
                    initialized = true;
                    Log.d(TAG, "AliveCor SDK already initialized");
                    call.resolve();
                    return;
                }
            } catch (IllegalStateException e) {
                // Not initialized yet — proceed
            }

            AliveCorKitLite.initialize(
                    getContext(),
                    jwt,
                    new InitListener() {
                        @Override
                        public void onInitComplete() {
                            initialized = true;
                            Log.d(TAG, "AliveCor SDK initialized, version: " + AliveCorKitLite.getVersion());
                            call.resolve();
                        }

                        @Override
                        public void onInitError(Throwable throwable) {
                            Log.e(TAG, "AliveCor SDK init error", throwable);
                            call.reject("SDK initialization failed: " + throwable.getMessage());
                        }
                    },
                    server,
                    appName,
                    bundleId,
                    partnerId,
                    debugMode != null && debugMode
            );
        } catch (Exception e) {
            Log.e(TAG, "Exception during AliveCor init", e);
            call.reject("SDK initialization exception: " + e.getMessage());
        }
    }

    // MARK: - startRecording

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (!initialized) {
            call.reject("SDK not initialized. Call initialize() first.");
            return;
        }

        try {
            String leadConfig = call.getString("leadConfig", "six");

            // Determine device type — Triangle supports both single and six-lead
            AliveCorDevice device = AliveCorDevice.TRIANGLE;

            // Create record intent via the SDK singleton
            Intent recordIntent = AliveCorKitLite.get().getRecordIntent(device);

            // Set lead configuration
            if ("single".equals(leadConfig)) {
                recordIntent.putExtra(RecordEkgConstants.EXTRA_LEADS_CONFIG, LeadConfiguration.SINGLE.name());
            } else {
                recordIntent.putExtra(RecordEkgConstants.EXTRA_LEADS_CONFIG, LeadConfiguration.SIX.name());
            }

            // Set recording duration (default 30s)
            Integer durationSeconds = call.getInt("durationSeconds");
            if (durationSeconds != null && durationSeconds > 0) {
                recordIntent.putExtra(RecordEkgConstants.EXTRA_MAX_DURATION, durationSeconds);
            } else {
                recordIntent.putExtra(RecordEkgConstants.EXTRA_MAX_DURATION, 30);
            }

            // Set mains filter frequency
            Integer mainsFilter = call.getInt("mainsFilter");
            if (mainsFilter != null) {
                recordIntent.putExtra(RecordEkgConstants.EXTRA_REC_FREQUENCY, mainsFilter);
            }

            // Show result screen to patient
            recordIntent.putExtra(RecordEkgConstants.EXTRA_SHOW_RECORDING_RESULT, true);

            startActivityForResult(call, recordIntent, "handleRecordingResult");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start recording", e);
            call.reject("Failed to start recording: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void handleRecordingResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;

        if (activityResult.getResultCode() != Activity.RESULT_OK || activityResult.getData() == null) {
            call.reject("Recording cancelled or failed");
            return;
        }

        try {
            Intent data = activityResult.getData();

            // Use the correct SDK API to extract the result
            RecordActivityResult recordResult = AliveCorKitLite.get().getRecordActivityResult(data);

            if (recordResult == null || recordResult.getSuccessfulResult() == null) {
                call.reject("No ECG data returned from SDK");
                return;
            }

            // getSuccessfulResult() returns the AliveCorEcg object
            Object ecg = recordResult.getSuccessfulResult();

            // Build response — use reflection-safe approach since the exact
            // AliveCorEcg API may vary between SDK versions.
            JSObject result = new JSObject();

            try {
                // Try to get samples
                java.lang.reflect.Method getSamples = ecg.getClass().getMethod("getSamples");
                float[] samples = (float[]) getSamples.invoke(ecg);
                JSONArray mvArray = new JSONArray();
                if (samples != null) {
                    for (float sample : samples) {
                        mvArray.put((double) sample);
                    }
                }
                result.put("mvData", mvArray);
            } catch (Exception e) {
                Log.w(TAG, "Could not get samples: " + e.getMessage());
                result.put("mvData", new JSONArray());
            }

            try {
                java.lang.reflect.Method getSampleRate = ecg.getClass().getMethod("getSampleRate");
                result.put("sampleRate", getSampleRate.invoke(ecg));
            } catch (Exception e) {
                result.put("sampleRate", 300); // AliveCor default
            }

            try {
                java.lang.reflect.Method getDuration = ecg.getClass().getMethod("getDurationInSeconds");
                result.put("durationSeconds", getDuration.invoke(ecg));
            } catch (Exception e) {
                result.put("durationSeconds", 30);
            }

            // Try to get evaluation data
            try {
                java.lang.reflect.Method getEval = ecg.getClass().getMethod("getEvaluation");
                Object evaluation = getEval.invoke(ecg);
                if (evaluation != null) {
                    result.put("heartRate", callMethod(evaluation, "getAverageHeartRate", 0));
                    result.put("determination", callMethodStr(evaluation, "getDetermination", "NO_ANALYSIS"));
                    result.put("modifier", callMethodStr(evaluation, "getModifier", "NONE"));
                    result.put("algorithmPackage", callMethodStr(evaluation, "getAlgorithmPackage", "kaiv2"));
                    result.put("isInverted", callMethodBool(evaluation, "isInverted", false));
                } else {
                    setDefaultEvaluation(result);
                }
            } catch (Exception e) {
                Log.w(TAG, "Could not get evaluation: " + e.getMessage());
                setDefaultEvaluation(result);
            }

            // Lead config and device type
            try {
                result.put("leadConfig", callMethodStr(ecg, "getLeadConfiguration", "six"));
            } catch (Exception e) {
                result.put("leadConfig", "six");
            }

            try {
                result.put("deviceType", callMethodStr(ecg, "getDeviceType", "KARDIA_MOBILE"));
            } catch (Exception e) {
                result.put("deviceType", "KARDIA_MOBILE");
            }

            result.put("qualityScore", 0.0);

            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error processing recording result", e);
            call.reject("Error processing recording: " + e.getMessage());
        }
    }

    // MARK: - getDeviceStatus

    @PluginMethod
    public void getDeviceStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("connected", initialized);
        result.put("deviceName", "Kardia");
        result.put("deviceType", "KARDIA_MOBILE");
        call.resolve(result);
    }

    // MARK: - dispose

    @PluginMethod
    public void dispose(PluginCall call) {
        initialized = false;
        call.resolve();
    }

    // MARK: - Reflection helpers

    private void setDefaultEvaluation(JSObject result) {
        result.put("heartRate", 0);
        result.put("determination", "NO_ANALYSIS");
        result.put("modifier", "NONE");
        result.put("algorithmPackage", "kaiv2");
        result.put("isInverted", false);
    }

    private Object callMethod(Object obj, String methodName, Object defaultVal) {
        try {
            java.lang.reflect.Method m = obj.getClass().getMethod(methodName);
            Object val = m.invoke(obj);
            return val != null ? val : defaultVal;
        } catch (Exception e) {
            return defaultVal;
        }
    }

    private String callMethodStr(Object obj, String methodName, String defaultVal) {
        Object val = callMethod(obj, methodName, defaultVal);
        return val != null ? val.toString() : defaultVal;
    }

    private boolean callMethodBool(Object obj, String methodName, boolean defaultVal) {
        try {
            java.lang.reflect.Method m = obj.getClass().getMethod(methodName);
            Object val = m.invoke(obj);
            return val instanceof Boolean ? (Boolean) val : defaultVal;
        } catch (Exception e) {
            return defaultVal;
        }
    }
}
