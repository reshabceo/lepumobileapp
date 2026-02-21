package com.monitraq.app.plugins;

import android.content.Intent;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import com.alivecor.api.AliveCorDevice;
import com.alivecor.api.AliveCorKitLite;
import com.alivecor.api.InitListener;
import com.alivecor.api.LeadConfiguration;
import com.alivecor.api.RecordingConfiguration;
import com.alivecor.ecg.record.RecordActivityResult;
import com.alivecor.ecg.record.RecordEkgConstants;
import com.alivecor.universal_monitor.Filter;

/**
 * Minimal Capacitor plugin that wraps the AliveCor Kardia
 * turnkey recording flow for 6‑lead ECG (KardiaMobile 6L).
 *
 * IMPORTANT:
 * - This assumes you have already set up the Kardia auth server
 * and are passing a valid short‑lived JWT from JS.
 * - It does NOT embed any AliveCor credentials directly.
 * - The SDK takes over the UI and shows its own recording UX.
 */
@CapacitorPlugin(name = "AliveCorSDK", permissions = {
        @Permission(alias = "bluetooth", strings = {
                android.Manifest.permission.BLUETOOTH,
                android.Manifest.permission.BLUETOOTH_ADMIN,
                android.Manifest.permission.ACCESS_FINE_LOCATION
        })
})
public class AliveCorSDKPlugin extends Plugin {
    private static final String TAG = "AliveCorSDKPlugin";

    @PluginMethod
    public void startSixLeadRecording(PluginCall call) {
        String jwt = call.getString("jwt");
        Integer mainsFreq = call.getInt("mainsFrequencyHz");

        if (jwt == null || jwt.isEmpty()) {
            call.reject("JWT token is required");
            return;
        }
        if (mainsFreq == null || (mainsFreq != 50 && mainsFreq != 60)) {
            call.reject("mainsFrequencyHz must be 50 or 60");
            return;
        }

        // Request Bluetooth permissions first if needed
        if (!hasRequiredPermissions()) {
            saveCall(call);
            requestAllPermissions();
            return;
        }

        Log.d(TAG, "Initializing AliveCorKitLite with provided JWT");

        // Initialize SDK with JWT. We intentionally do NOT hard‑code partner
        // credentials here; JWT already encodes all provisioning.
        AliveCorKitLite.initialize(
                getActivity(),
                jwt,
                new InitListener() {
                    @Override
                    public void onInitComplete() {
                        Log.d(TAG, "AliveCorKitLite initialized, starting 6‑lead recording");
                        startRecordingInternal(call, mainsFreq);
                    }

                    @Override
                    public void onInitError(Throwable throwable) {
                        Log.e(TAG, "AliveCorKitLite init error", throwable);
                        call.reject("AliveCor initialization failed: " + throwable.getMessage());
                    }
                });
    }

    private void startRecordingInternal(@NonNull PluginCall call, int mainsFreqHz) {
        try {
            // Default device: TRIANGLE (KardiaMobile 6L) in six‑lead mode
            AliveCorDevice device = AliveCorDevice.TRIANGLE;
            LeadConfiguration leadsConfig = LeadConfiguration.SIX;

            // Build recording configuration to prefer six‑lead with enhanced filter
            RecordingConfiguration config = new RecordingConfiguration();
            config.setDevice(device);
            config.setLeads(leadsConfig);
            config.setFilterType(Filter.ENHANCED);
            config.setMaxDurationSeconds(30);
            config.setResetDurationSeconds(10);
            if (mainsFreqHz == 50) {
                config.setMainsFrequency(RecordingConfiguration.MAINS_FREQUENCY_50Hz);
            } else {
                config.setMainsFrequency(RecordingConfiguration.MAINS_FREQUENCY_60Hz);
            }

            Intent intent = AliveCorKitLite.get().getRecordIntent(device);
            intent.putExtra(RecordEkgConstants.EXTRA_LEADS_CONFIG, leadsConfig.name());
            intent.putExtra(RecordEkgConstants.EXTRA_MAX_DURATION, 30);
            intent.putExtra(RecordEkgConstants.EXTRA_FILTER_TYPE, Filter.ENHANCED.name());
            intent.putExtra(RecordEkgConstants.EXTRA_REC_FREQUENCY, mainsFreqHz);
            intent.putExtra(RecordEkgConstants.EXTRA_SHOW_RECORDING_RESULT, true);

            // Use Capacitor's activity callback helper so we can resolve with a
            // simple success/failure flag. Detailed result parsing can be added later.
            startActivityForResult(call, intent, "handleRecordingResult");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start AliveCor recording", e);
            call.reject("Failed to start AliveCor recording: " + e.getMessage());
        }
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        if (!hasRequiredPermissions()) {
            call.reject("Bluetooth permissions not granted");
            return;
        }

        // Permissions granted, but we need the original JWT and mainsFrequency again.
        // The simplest approach is to ask the web layer to re‑invoke
        // startSixLeadRecording.
        JSObject result = new JSObject();
        result.put("success", false);
        result.put("requiresRetry", true);
        call.resolve(result);
    }

    private boolean hasRequiredPermissions() {
        return hasPermission("bluetooth");
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        // Activity result is bridged via the @ActivityCallback method below.
    }

    @com.getcapacitor.annotation.ActivityCallback
    private void handleRecordingResult(PluginCall call, com.getcapacitor.PluginCall.ActivityResult result) {
        try {
            RecordActivityResult recordResult = AliveCorKitLite.get().getRecordActivityResult(result.getData());
            JSObject js = new JSObject();

            if (recordResult != null && recordResult.getSuccessfulResult() != null) {
                js.put("success", true);
                if (recordResult.getSuccessfulResult().getEvaluation() != null) {
                    js.put("heartRate", recordResult.getSuccessfulResult().getEvaluation().getAverageHeartRate());
                    js.put(
                            "diagnosisText",
                            recordResult.getSuccessfulResult().getEvaluation().getDetermination().toString());
                }
            } else {
                js.put("success", false);
            }

            call.resolve(js);
        } catch (Exception e) {
            Log.e(TAG, "Error handling AliveCor recording result", e);
            call.reject("Failed to process recording result: " + e.getMessage());
        }
    }
}
