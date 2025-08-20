package com.priti.app.wellue;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(
    name = "WellueSDK",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        )
    }
)
public class WellueSDKPlugin extends Plugin {
    private static final String TAG = "WellueSDKPlugin";
    
    private BluetoothAdapter bluetoothAdapter;
    private Map<String, BluetoothDevice> connectedDevices = new HashMap<>();
    private List<BluetoothDevice> scannedDevices = new ArrayList<>();
    private boolean isScanning = false;
    
    @Override
    public void load() {
        super.load();
        Log.d(TAG, "WellueSDKPlugin loaded");
        
        // Initialize Bluetooth adapter
        BluetoothManager bluetoothManager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            bluetoothAdapter = bluetoothManager.getAdapter();
        }
    }
    
    @PluginMethod
    public void initialize(PluginCall call) {
        try {
            Log.d(TAG, "Initializing Wellue SDK");
            
            // Check Bluetooth permissions
            if (!checkBluetoothPermissions()) {
                call.reject("Bluetooth permissions not granted");
                return;
            }
            
            // Check if Bluetooth is enabled
            if (!isBluetoothEnabled()) {
                call.reject("Bluetooth is not enabled");
                return;
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Wellue SDK initialized successfully");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Wellue SDK", e);
            call.reject("Failed to initialize: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void isBluetoothEnabled(PluginCall call) {
        try {
            boolean enabled = isBluetoothEnabled();
            JSObject result = new JSObject();
            result.put("enabled", enabled);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to check Bluetooth status: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void startScan(PluginCall call) {
        try {
            Log.d(TAG, "Starting BP2 device scan");
            
            if (!checkBluetoothPermissions()) {
                call.reject("Bluetooth permissions not granted");
                return;
            }
            
            if (isScanning) {
                call.reject("Scan already in progress");
                return;
            }
            
            // Clear previous scan results
            scannedDevices.clear();
            
            // Start scanning for devices
            isScanning = true;
            bluetoothAdapter.startDiscovery();
            
            // Simulate finding BP2 devices (since we can't access the actual Wellue SDK yet)
            simulateBP2DeviceDiscovery();
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "BP2 scan started");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to start scan", e);
            call.reject("Failed to start scan: " + e.getMessage());
        }
    }
    
    private void simulateBP2DeviceDiscovery() {
        // Simulate finding BP2 devices after a short delay
        new android.os.Handler().postDelayed(() -> {
            try {
                // Simulate finding a BP2 device
                JSObject deviceInfo = new JSObject();
                deviceInfo.put("id", "BP2-SIMULATED-001");
                deviceInfo.put("name", "BP2 Blood Pressure Monitor");
                deviceInfo.put("address", "AA:BB:CC:DD:EE:FF");
                deviceInfo.put("rssi", -65);
                deviceInfo.put("type", "BP2");
                
                notifyListeners("deviceFound", deviceInfo);
                
                // Stop scanning after finding device
                stopScanInternal();
                
            } catch (Exception e) {
                Log.e(TAG, "Error in simulated device discovery", e);
            }
        }, 2000); // 2 second delay
    }
    
    @PluginMethod
    public void stopScan(PluginCall call) {
        try {
            Log.d(TAG, "Stopping BP2 device scan");
            stopScanInternal();
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "BP2 scan stopped");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop scan", e);
            call.reject("Failed to stop scan: " + e.getMessage());
        }
    }
    
    private void stopScanInternal() {
        if (isScanning && bluetoothAdapter != null) {
            bluetoothAdapter.cancelDiscovery();
            isScanning = false;
        }
    }
    
    @PluginMethod
    public void connect(PluginCall call) {
        try {
            String address = call.getString("address");
            if (address == null || address.isEmpty()) {
                call.reject("Device address is required");
                return;
            }
            
            Log.d(TAG, "Connecting to BP2 device: " + address);
            
            // Simulate connection to BP2 device
            simulateBP2Connection(address, call);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to connect to BP2", e);
            call.reject("Failed to connect to BP2: " + e.getMessage());
        }
    }
    
    private void simulateBP2Connection(String address, PluginCall call) {
        // Simulate connection process
        new android.os.Handler().postDelayed(() -> {
            try {
                // Simulate successful connection
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("message", "BP2 connected successfully");
                result.put("address", address);
                result.put("deviceName", "BP2 Blood Pressure Monitor");
                call.resolve(result);
                
                // Notify listeners
                JSObject connectionInfo = new JSObject();
                connectionInfo.put("address", address);
                connectionInfo.put("status", "connected");
                notifyListeners("deviceConnected", connectionInfo);
                
            } catch (Exception e) {
                Log.e(TAG, "Error in simulated connection", e);
                call.reject("Connection failed: " + e.getMessage());
            }
        }, 1500); // 1.5 second delay
    }
    
    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            String address = call.getString("address");
            if (address == null || address.isEmpty()) {
                call.reject("Device address is required");
                return;
            }
            
            Log.d(TAG, "Disconnecting from BP2 device: " + address);
            
            // Simulate disconnection
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "BP2 disconnected successfully");
            call.resolve(result);
            
            // Notify listeners
            JSObject disconnectionInfo = new JSObject();
            disconnectionInfo.put("address", address);
            disconnectionInfo.put("status", "disconnected");
            notifyListeners("deviceDisconnected", disconnectionInfo);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to disconnect from BP2", e);
            call.reject("Failed to disconnect from BP2: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void startBPMeasurement(PluginCall call) {
        try {
            String address = call.getString("address");
            if (address == null || address.isEmpty()) {
                call.reject("Device address is required");
                return;
            }
            
            Log.d(TAG, "Starting BP2 measurement for device: " + address);
            
            // Simulate starting BP measurement
            simulateBP2Measurement(address, call);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to start BP2 measurement", e);
            call.reject("Failed to start BP2 measurement: " + e.getMessage());
        }
    }
    
    private void simulateBP2Measurement(String address, PluginCall call) {
        // Simulate BP measurement process
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "BP2 measurement started");
        call.resolve(result);
        
        // Simulate measurement progress
        simulateMeasurementProgress(address);
    }
    
    private void simulateMeasurementProgress(String address) {
        // Simulate measurement progress updates
        new android.os.Handler().postDelayed(() -> {
            try {
                // Simulate inflating
                JSObject progress = new JSObject();
                progress.put("status", "inflating");
                progress.put("pressure", 50);
                progress.put("timestamp", System.currentTimeMillis());
                notifyListeners("bpProgress", progress);
                
                // Simulate holding
                new android.os.Handler().postDelayed(() -> {
                    try {
                        JSObject progress2 = new JSObject();
                        progress2.put("status", "holding");
                        progress2.put("pressure", 120);
                        progress2.put("timestamp", System.currentTimeMillis());
                        notifyListeners("bpProgress", progress2);
                        
                        // Simulate deflating and measurement
                        new android.os.Handler().postDelayed(() -> {
                            try {
                                JSObject progress3 = new JSObject();
                                progress3.put("status", "deflating");
                                progress3.put("pressure", 80);
                                progress3.put("timestamp", System.currentTimeMillis());
                                notifyListeners("bpProgress", progress3);
                                
                                // Simulate final measurement
                                new android.os.Handler().postDelayed(() -> {
                                    try {
                                        JSObject measurement = new JSObject();
                                        measurement.put("systolic", 125);
                                        measurement.put("diastolic", 82);
                                        measurement.put("pulseRate", 72);
                                        measurement.put("timestamp", System.currentTimeMillis());
                                        notifyListeners("bpMeasurement", measurement);
                                        
                                    } catch (Exception e) {
                                        Log.e(TAG, "Error in final measurement", e);
                                    }
                                }, 2000);
                                
                            } catch (Exception e) {
                                Log.e(TAG, "Error in deflating progress", e);
                            }
                        }, 2000);
                        
                    } catch (Exception e) {
                        Log.e(TAG, "Error in holding progress", e);
                    }
                }, 2000);
                
            } catch (Exception e) {
                Log.e(TAG, "Error in inflating progress", e);
            }
        }, 1000);
    }
    
    @PluginMethod
    public void startECGMeasurement(PluginCall call) {
        try {
            String address = call.getString("address");
            if (address == null || address.isEmpty()) {
                call.reject("Device address is required");
                return;
            }
            
            Log.d(TAG, "Starting ECG measurement for device: " + address);
            
            // Simulate starting ECG measurement
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "ECG measurement started");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to start ECG measurement", e);
            call.reject("Failed to start ECG measurement: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void stopMeasurement(PluginCall call) {
        try {
            String address = call.getString("address");
            if (address == null || address.isEmpty()) {
                call.reject("Device address is required");
                return;
            }
            
            Log.d(TAG, "Stopping measurement for device: " + address);
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Measurement stopped");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop measurement", e);
            call.reject("Failed to stop measurement: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void getBatteryLevel(PluginCall call) {
        try {
            String address = call.getString("address");
            if (address == null || address.isEmpty()) {
                call.reject("Device address is required");
                return;
            }
            
            Log.d(TAG, "Getting battery level for device: " + address);
            
            // Simulate battery level
            int batteryLevel = 85; // Default value
            
            JSObject result = new JSObject();
            result.put("batteryLevel", batteryLevel);
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to get battery level", e);
            call.reject("Failed to get battery level: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void getConnectedDevices(PluginCall call) {
        try {
            List<JSObject> devices = new ArrayList<>();
            
            for (Map.Entry<String, BluetoothDevice> entry : connectedDevices.entrySet()) {
                BluetoothDevice device = entry.getValue();
                JSObject deviceInfo = new JSObject();
                deviceInfo.put("id", device.getAddress());
                deviceInfo.put("name", device.getName());
                deviceInfo.put("address", device.getAddress());
                deviceInfo.put("isConnected", true);
                devices.add(deviceInfo);
            }
            
            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to get connected devices", e);
            call.reject("Failed to get connected devices: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void isDeviceConnected(PluginCall call) {
        try {
            String address = call.getString("address");
            if (address == null || address.isEmpty()) {
                call.reject("Device address is required");
                return;
            }
            
            boolean isConnected = connectedDevices.containsKey(address);
            
            JSObject result = new JSObject();
            result.put("connected", isConnected);
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to check device connection", e);
            call.reject("Failed to check device connection: " + e.getMessage());
        }
    }
    
    private boolean checkBluetoothPermissions() {
        return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED &&
               ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_ADMIN) == PackageManager.PERMISSION_GRANTED &&
               ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
    
    private boolean isBluetoothEnabled() {
        return bluetoothAdapter != null && bluetoothAdapter.isEnabled();
    }
}
