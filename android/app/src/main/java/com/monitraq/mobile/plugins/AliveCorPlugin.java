package com.monitraq.mobile.plugins;

import android.content.Intent;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import com.alivecor.api.AliveCorDevice;
import com.alivecor.api.AliveCorEcg;
import com.alivecor.api.EcgEvaluation;
import com.alivecor.api.RecordingConfiguration;
import com.alivecor.atc.ATCReader;
import com.alivecor.ecgcore.ECGLead;
import com.alivecor.ecgcore.ECGSignal;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AliveCorSDK")
public class AliveCorPlugin extends Plugin {
    private static final String TAG = "AliveCorPlugin";

    @PluginMethod
    public void initialize(PluginCall call) {
        String jwt = call.getString("jwt");
        boolean isDebug = call.getBoolean("isDebugMode", false);

        if (jwt == null) {
            call.reject("JWT is required for initialization");
            return;
        }

        try {
            AliveCorKit.initialize(
                getContext(),
                jwt,
                new InitListener() {
                    @Override
                    public void onInitComplete() {
                        Log.d(TAG, "AliveCor SDK Initialized successfully");
                        call.resolve();
                    }

                    @Override
                    public void onInitError(Throwable throwable) {
                        Log.e(TAG, "AliveCor SDK Initialization failed", throwable);
                        call.reject("Initialization failed: " + throwable.getMessage());
                    }
                },
                "com.monitraq.mobile",
                "Monitraq",
                "1.9",
                isDebug
            );
        } catch (Exception e) {
            call.reject("Failed to initialize: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startSixLeadRecording(PluginCall call) {
        String leadConfig = call.getString("leadConfig", "six");
        
        AliveCorDevice device = AliveCorDevice.K6LMAX; 
        if ("single".equalsIgnoreCase(leadConfig)) {
            device = AliveCorDevice.KARDIA_MOBILE;
        }

        try {
            String patientId = call.getString("patientId", "monitraq_patient");
            Intent intent = AliveCorKit.get().getRecordIntent(device, patientId);
            startActivityForResult(call, intent, "recordCallback");
        } catch (Exception e) {
            call.reject("Failed to start recording: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void recordCallback(PluginCall call, ActivityResult result) {
        if (call == null) return;

        try {
            Intent data = result.getData();
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
                ret.put("deviceType", ecg.getDeviceInfo() != null ? ecg.getDeviceInfo().getDeviceName() : "KardiaMobile 6L");
                ret.put("isInverted", eval != null && eval.isInverted());

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
        } catch (Exception e) {
            call.reject("Error processing recording result: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDeviceStatus(PluginCall call) {
        android.bluetooth.BluetoothAdapter adapter = android.bluetooth.BluetoothAdapter.getDefaultAdapter();
        boolean btEnabled = adapter != null && adapter.isEnabled();

        JSObject result = new JSObject();
        result.put("connected", btEnabled);
        result.put("deviceName", btEnabled ? "KardiaMobile 6L" : "");
        result.put("deviceType", "ECG");
        result.put("bluetoothEnabled", btEnabled);
        call.resolve(result);
    }

    @PluginMethod
    public void dispose(PluginCall call) {
        call.resolve();
    }
}
