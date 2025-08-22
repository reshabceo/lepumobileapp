package com.priti.app.plugins;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.lepu.blepro.ext.BleServiceHelper;
import com.lepu.blepro.event.EventMsgConst;
import com.lepu.blepro.event.InterfaceEvent;
import com.lepu.blepro.objs.Bluetooth;
import androidx.lifecycle.MutableLiveData;
import com.jeremyliao.liveeventbus.LiveEventBus;
import android.util.Log;
import android.content.Context;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;

@CapacitorPlugin(name = "Bp2")
public class Bp2Plugin extends Plugin {
    private final MutableLiveData<Boolean> serviceReady = new MutableLiveData<>(false);
    private Object bleHelperInstance = null;
    private int currentModel = Bluetooth.MODEL_BP2; // Default to BP2, will be detected
    private boolean isBp2w = false;

    private Object getBleHelper() {
        if (bleHelperInstance != null) {
            return bleHelperInstance;
        }
        try {
            Class<?> helper = Class.forName("com.lepu.blepro.ext.BleServiceHelper");
            
            // Try Companion.getBleServiceHelper()
            try {
                Object companion = helper.getField("Companion").get(null);
                for (java.lang.reflect.Method m : companion.getClass().getMethods()) {
                    if (m.getReturnType() == helper && m.getParameterCount() == 0 && m.getName().toLowerCase().contains("bleservicehelper")) {
                        bleHelperInstance = m.invoke(companion);
                        break;
                    }
                }
            } catch (Throwable ignore) {
                // Fallback: construct instance directly
                bleHelperInstance = helper.getDeclaredConstructor().newInstance();
            }
        } catch (Throwable t) {
            Log.e("Bp2Plugin", "Failed to obtain BleServiceHelper instance", t);
        }
        return bleHelperInstance;
    }

    @Override 
    public void load() {
        super.load();
        // Observe service ready (SDK posts this)
        LiveEventBus.get(EventMsgConst.Ble.EventServiceConnectedAndInterfaceInit, Boolean.class)
            .observeForever(ready -> serviceReady.postValue(true));
    }

    @PluginMethod
    public void listEcgRecords(PluginCall call) {
        Log.d("Bp2Plugin", "Starting ECG records list...");
        
        Object bleHelper = getBleHelper();
        if (bleHelper == null) {
            call.reject("BleServiceHelper not available");
            return;
        }

        // Detect if we should use BP2W based on connected device
        try {
            // Get connected devices to determine model
            java.lang.reflect.Method getConnectedDevices = bleHelper.getClass().getMethod("getConnectedDevices");
            Object connectedDevices = getConnectedDevices.invoke(bleHelper);
            
            if (connectedDevices instanceof ArrayList) {
                ArrayList<?> devices = (ArrayList<?>) connectedDevices;
                for (Object device : devices) {
                    if (device != null) {
                        try {
                            java.lang.reflect.Method getName = device.getClass().getMethod("getName");
                            String name = (String) getName.invoke(device);
                            if (name != null && name.toLowerCase().contains("bp2w")) {
                                currentModel = Bluetooth.MODEL_BP2W;
                                isBp2w = true;
                                Log.d("Bp2Plugin", "Detected BP2W model");
                                break;
                            }
                        } catch (Exception e) {
                            Log.w("Bp2Plugin", "Could not get device name", e);
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w("Bp2Plugin", "Could not detect model, using default BP2", e);
        }

        try {
            bleHelper.getClass().getMethod("setInterfaces", int.class).invoke(bleHelper, currentModel);
            
            // Request file list based on model
            if (!isBp2w) {
                Log.d("Bp2Plugin", "Requesting BP2 file list...");
                bleHelper.getClass().getMethod("bp2GetFileList", int.class).invoke(bleHelper, currentModel);
            } else {
                Log.d("Bp2Plugin", "Requesting BP2W file list...");
                bleHelper.getClass().getMethod("bp2wGetFileList", int.class).invoke(bleHelper, currentModel);
            }
        } catch (Exception e) {
            Log.e("Bp2Plugin", "Failed to request file list", e);
            call.reject("Failed to request file list: " + e.getMessage());
            return;
        }

        // Listen for file list response
        if (!isBp2w) {
            LiveEventBus.get(InterfaceEvent.BP2.EventBp2FileList, InterfaceEvent.class)
                .observeForever(evt -> handleFileListResponse(evt, call));
        } else {
            LiveEventBus.get(InterfaceEvent.BP2W.EventBp2wFileList, InterfaceEvent.class)
                .observeForever(evt -> handleFileListResponse(evt, call));
        }
    }

    private void handleFileListResponse(InterfaceEvent evt, PluginCall call) {
        try {
            @SuppressWarnings("unchecked")
            ArrayList<String> allFiles = (ArrayList<String>) evt.getData();
            
            if (allFiles == null || allFiles.isEmpty()) {
                call.resolve(new JSObject().put("records", new JSArray()));
                return;
            }

            Log.d("Bp2Plugin", "Received " + allFiles.size() + " files from device");
            
            // Return all files - filtering will be done on read attempt
            JSArray arr = new JSArray();
            for (String f : allFiles) arr.put(f);
            JSObject ret = new JSObject().put("records", arr);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e("Bp2Plugin", "Error handling file list response", e);
            call.reject("Error processing file list: " + e.getMessage());
        }
    }





    @PluginMethod
    public void getEcgRecord(PluginCall call) {
        String recordId = call.getString("recordId");
        if (recordId == null) {
            call.reject("recordId required");
            return;
        }

        Log.d("Bp2Plugin", "Reading ECG record: " + recordId);

        // Detect if we should use BP2W based on connected device
        boolean isBp2w = false;
        try {
            Object bleHelper = getBleHelper();
            if (bleHelper != null) {
                // Try to get connected device info
                try {
                    java.lang.reflect.Method getConnectedDevices = bleHelper.getClass().getMethod("getConnectedDevices");
                    Object devices = getConnectedDevices.invoke(bleHelper);
                    if (devices instanceof java.util.List) {
                        java.util.List<?> deviceList = (java.util.List<?>) devices;
                        for (Object device : deviceList) {
                            try {
                                java.lang.reflect.Method getName = device.getClass().getMethod("getName");
                                Object name = getName.invoke(device);
                                if (name instanceof String && ((String) name).contains("BP2W")) {
                                    isBp2w = true;
                                    break;
                                }
                            } catch (Exception e) {
                                // Ignore individual device errors
                            }
                        }
                    }
                } catch (Exception e) {
                    // getConnectedDevices method doesn't exist in this AAR variant
                    Log.d("Bp2Plugin", "getConnectedDevices not available, using default BP2");
                }
            }
        } catch (Exception e) {
            Log.w("Bp2Plugin", "Could not detect model, using default BP2");
        }

        // Request file read based on model
        try {
            Object bleHelper = getBleHelper();
            if (bleHelper == null) {
                call.reject("BLE helper not available");
                return;
            }

            if (!isBp2w) {
                java.lang.reflect.Method bp2ReadFile = bleHelper.getClass().getMethod("bp2ReadFile", int.class, String.class);
                bp2ReadFile.invoke(bleHelper, currentModel, recordId);
            } else {
                java.lang.reflect.Method bp2wReadFile = bleHelper.getClass().getMethod("bp2wReadFile", int.class, String.class);
                bp2wReadFile.invoke(bleHelper, currentModel, recordId);
            }

            // Set up observers with proper cleanup to prevent memory leaks and duplicate resolves
            final boolean useBp2w = isBp2w;
            final String COMPLETE_KEY = useBp2w
                    ? InterfaceEvent.BP2W.EventBp2wReadFileComplete
                    : InterfaceEvent.BP2.EventBp2ReadFileComplete;
            final String ERROR_KEY = useBp2w
                    ? InterfaceEvent.BP2W.EventBp2wReadFileError
                    : InterfaceEvent.BP2.EventBp2ReadFileError;

            final java.util.concurrent.atomic.AtomicBoolean handled = new java.util.concurrent.atomic.AtomicBoolean(false);
            final java.util.concurrent.atomic.AtomicReference<androidx.lifecycle.Observer<InterfaceEvent>> completeRef = new java.util.concurrent.atomic.AtomicReference<>();
            final java.util.concurrent.atomic.AtomicReference<androidx.lifecycle.Observer<InterfaceEvent>> errorRef = new java.util.concurrent.atomic.AtomicReference<>();

            androidx.lifecycle.Observer<InterfaceEvent> completeObs = evt -> {
                if (handled.compareAndSet(false, true)) {
                    try {
                        // stop listening first to avoid races
                        LiveEventBus.get(COMPLETE_KEY, InterfaceEvent.class).removeObserver(completeRef.get());
                        LiveEventBus.get(ERROR_KEY, InterfaceEvent.class).removeObserver(errorRef.get());

                        // process success
                        Object data = evt.getData();
                        handleBp2EcgComplete(data, call, useBp2w);
                    } catch (Throwable t) {
                        call.reject("Error handling ECG completion: " + t.getMessage());
                    }
                }
            };
            completeRef.set(completeObs);
            LiveEventBus.get(COMPLETE_KEY, InterfaceEvent.class).observeForever(completeObs);

            androidx.lifecycle.Observer<InterfaceEvent> errorObs = evt -> {
                if (handled.compareAndSet(false, true)) {
                    // stop listening
                    LiveEventBus.get(COMPLETE_KEY, InterfaceEvent.class).removeObserver(completeRef.get());
                    LiveEventBus.get(ERROR_KEY, InterfaceEvent.class).removeObserver(errorRef.get());

                    // propagate error
                    call.reject("Read error: " + String.valueOf(evt.getData()));
                }
            };
            errorRef.set(errorObs);
            LiveEventBus.get(ERROR_KEY, InterfaceEvent.class).observeForever(errorObs);

        } catch (Exception e) {
            Log.e("Bp2Plugin", "Error requesting file read", e);
            call.reject("Error requesting file read: " + e.getMessage());
        }
    }

    private void handleBp2EcgComplete(Object data, PluginCall call, boolean isBp2w) {
        try {
            Log.d("Bp2Plugin", "Processing ECG file completion, BP2W: " + isBp2w);
            
            // If the SDK ever returns an EcgFile directly
            if (data != null && data.getClass().getSimpleName().contains("EcgFile")) {
                Log.d("Bp2Plugin", "Data is already an EcgFile, processing directly");
                resolveEcg(call, getWaveShortData(data), getWaveFloatData(data), 125, getRecordingTime(data));
                return;
            }
            
            // Extract wave data using our robust unwrapping
            short[] shorts = getWaveShortData(data);
            float[] floats = getWaveFloatData(data);
            Integer durationSec = getRecordingTime(data);
            
            Log.d("Bp2Plugin", "Resolving ECG data - shorts: " + (shorts != null ? shorts.length : 0) + 
                  ", floats: " + (floats != null ? floats.length : 0));
            
            resolveEcg(call, shorts, floats, 125, durationSec);
            
        } catch (Exception e) {
            Log.e("Bp2Plugin", "Error processing ECG completion", e);
            call.reject("Error processing ECG data: " + e.getMessage());
        }
    }

    private Integer getFileType(Object file) {
        try {
            java.lang.reflect.Method getType = file.getClass().getMethod("getType");
            Object result = getType.invoke(file);
            if (result instanceof Number) {
                return ((Number) result).intValue();
            }
        } catch (Exception e) {
            Log.w("Bp2Plugin", "Could not get file type", e);
        }
        return null;
    }

    private Object unwrapEcgFile(Object file) {
        if (file == null) return null;

        // 1) Already an EcgFile?
        String cls = file.getClass().getName();
        if (cls.endsWith(".EcgFile") || file.getClass().getSimpleName().equalsIgnoreCase("EcgFile")) {
            Log.d("Bp2Plugin", "unwrapEcgFile: data is already an EcgFile -> " + cls);
            return file;
        }

        // 2) Try known getter names first
        String[] known = {"getEcgFile", "getEcg", "getFile", "getContent"};
        for (String name : known) {
            try {
                java.lang.reflect.Method m = file.getClass().getMethod(name);
                Object r = m.invoke(file);
                if (r != null) {
                    String rcls = r.getClass().getName();
                    Log.d("Bp2Plugin", "unwrapEcgFile: " + name + "() -> " + rcls);
                    if (rcls.endsWith(".EcgFile") || r.getClass().getSimpleName().contains("EcgFile")) {
                        return r;
                    }
                }
            } catch (Throwable ignore) {}
        }

        // 3) Heuristic: any no-arg method returning *EcgFile*
        for (java.lang.reflect.Method m : file.getClass().getMethods()) {
            if (m.getParameterCount() == 0) {
                try {
                    Class<?> rt = m.getReturnType();
                    if (rt != null && (rt.getSimpleName().contains("EcgFile") || rt.getName().endsWith(".EcgFile"))) {
                        Object r = m.invoke(file);
                        if (r != null) {
                            Log.d("Bp2Plugin", "unwrapEcgFile: via method " + m.getName() + "() -> " + r.getClass().getName());
                            return r;
                        }
                    }
                } catch (Throwable ignore) {}
            }
        }

        // 4) Heuristic: any field of type *EcgFile*
        try {
            for (java.lang.reflect.Field f : file.getClass().getDeclaredFields()) {
                Class<?> ft = f.getType();
                if (ft != null && (ft.getSimpleName().contains("EcgFile") || ft.getName().endsWith(".EcgFile"))) {
                    f.setAccessible(true);
                    Object r = f.get(file);
                    if (r != null) {
                        Log.d("Bp2Plugin", "unwrapEcgFile: via field " + f.getName() + " -> " + r.getClass().getName());
                        return r;
                    }
                }
            }
        } catch (Throwable ignore) {}

        Log.w("Bp2Plugin", "unwrapEcgFile: could not find inner EcgFile inside " + cls);
        return null;
    }

    private short[] getWaveShortData(Object file) {
        try {
            Log.d("Bp2Plugin", "=== getWaveShortData ===");
            Object ecg = unwrapEcgFile(file);

            if (ecg == null) {
                // Fallback: parse bytes -> EcgFile
                Log.d("Bp2Plugin", "unwrapEcgFile failed, trying to build EcgFile from bytes");
                byte[] content = null;
                try {
                    java.lang.reflect.Method m = file.getClass().getMethod("getContent");
                    Object r = m.invoke(file);
                    if (r instanceof byte[]) {
                        content = (byte[]) r;
                        Log.d("Bp2Plugin", "Got content bytes, length: " + content.length);
                    }
                } catch (Throwable t) {
                    Log.d("Bp2Plugin", "getContent() not available: " + t);
                }
                if (content != null) {
                    // Try to determine if this is BP2W based on the file object
                    boolean isBp2w = false;
                    try {
                        String className = file.getClass().getName();
                        isBp2w = className.contains("bp2w") || className.contains("BP2W");
                    } catch (Throwable ignore) {}
                    
                    ecg = buildEcgFileFromBytes(content, isBp2w);
                    if (ecg != null) {
                        Log.d("Bp2Plugin", "Successfully built EcgFile from bytes");
                    } else {
                        Log.w("Bp2Plugin", "Failed to build EcgFile from bytes");
                    }
                }
            }

            if (ecg == null) {
                Log.w("Bp2Plugin", "No EcgFile available to read short data");
                return null;
            }

            // Primary: getWaveShortData()
            try {
                java.lang.reflect.Method m = ecg.getClass().getMethod("getWaveShortData");
                Object r = m.invoke(ecg);
                if (r instanceof short[]) {
                    short[] shorts = (short[]) r;
                    Log.d("Bp2Plugin", "SUCCESS: Found short[] data from EcgFile: " + shorts.length + " samples");
                    return shorts;
                }
            } catch (Throwable e) {
                Log.d("Bp2Plugin", "EcgFile.getWaveShortData() not available: " + e);
            }

            // Fallbacks
            for (String alt : new String[]{"getShortData", "getWaveData"}) {
                try {
                    java.lang.reflect.Method m = ecg.getClass().getMethod(alt);
                    Object r = m.invoke(ecg);
                    if (r instanceof short[]) {
                        short[] shorts = (short[]) r;
                        Log.d("Bp2Plugin", "SUCCESS: Found short[] data via " + alt + ": " + shorts.length + " samples");
                        return shorts;
                    }
                    if (r instanceof byte[]) {
                        byte[] b = (byte[]) r;
                        short[] s = new short[b.length / 2];
                        java.nio.ByteBuffer bb = java.nio.ByteBuffer.wrap(b).order(java.nio.ByteOrder.LITTLE_ENDIAN);
                        for (int i = 0; i < s.length; i++) s[i] = bb.getShort();
                        Log.d("Bp2Plugin", "SUCCESS: Converted byte[] to short[] via " + alt + ": " + s.length + " samples");
                        return s;
                    }
                } catch (Throwable ignore) {}
            }

        } catch (Throwable t) {
            Log.e("Bp2Plugin", "getWaveShortData fatal", t);
        }
        return null;
    }

    private float[] getWaveFloatData(Object file) {
        try {
            Log.d("Bp2Plugin", "=== getWaveFloatData ===");
            Object ecg = unwrapEcgFile(file);

            if (ecg == null) {
                // Fallback: parse bytes -> EcgFile
                Log.d("Bp2Plugin", "unwrapEcgFile failed, trying to build EcgFile from bytes");
                byte[] content = null;
                try {
                    java.lang.reflect.Method m = file.getClass().getMethod("getContent");
                    Object r = m.invoke(file);
                    if (r instanceof byte[]) {
                        content = (byte[]) r;
                        Log.d("Bp2Plugin", "Got content bytes, length: " + content.length);
                    }
                } catch (Throwable t) {
                    Log.d("Bp2Plugin", "getContent() not available: " + t);
                }
                if (content != null) {
                    // Try to determine if this is BP2W based on the file object
                    boolean isBp2w = false;
                    try {
                        String className = file.getClass().getName();
                        isBp2w = className.contains("bp2w") || className.contains("BP2W");
                    } catch (Throwable ignore) {}
                    
                    ecg = buildEcgFileFromBytes(content, isBp2w);
                    if (ecg != null) {
                        Log.d("Bp2Plugin", "Successfully built EcgFile from bytes");
                    } else {
                        Log.w("Bp2Plugin", "Failed to build EcgFile from bytes");
                    }
                }
            }

            if (ecg == null) {
                Log.w("Bp2Plugin", "No EcgFile available to read float data");
                return null;
            }

            try {
                java.lang.reflect.Method m = ecg.getClass().getMethod("getWaveFloatData");
                Object r = m.invoke(ecg);
                if (r instanceof float[]) {
                    float[] floats = (float[]) r;
                    Log.d("Bp2Plugin", "SUCCESS: Found float[] data from EcgFile: " + floats.length + " samples");
                    return floats;
                }
            } catch (Throwable e) {
                Log.d("Bp2Plugin", "EcgFile.getWaveFloatData() not available: " + e);
            }
        } catch (Throwable t) {
            Log.e("Bp2Plugin", "getWaveFloatData fatal", t);
        }
        return null;
    }

    private Integer getRecordingTime(Object file) {
        try {
            Log.d("Bp2Plugin", "=== getRecordingTime ===");
            Object ecg = unwrapEcgFile(file);

            if (ecg == null) {
                // Fallback: parse bytes -> EcgFile
                Log.d("Bp2Plugin", "unwrapEcgFile failed, trying to build EcgFile from bytes");
                byte[] content = null;
                try {
                    java.lang.reflect.Method m = file.getClass().getMethod("getContent");
                    Object r = m.invoke(file);
                    if (r instanceof byte[]) {
                        content = (byte[]) r;
                        Log.d("Bp2Plugin", "Got content bytes, length: " + content.length);
                    }
                } catch (Throwable t) {
                    Log.d("Bp2Plugin", "getContent() not available: " + t);
                }
                if (content != null) {
                    // Try to determine if this is BP2W based on the file object
                    boolean isBp2w = false;
                    try {
                        String className = file.getClass().getName();
                        isBp2w = className.contains("bp2w") || className.contains("BP2W");
                    } catch (Throwable ignore) {}
                    
                    ecg = buildEcgFileFromBytes(content, isBp2w);
                    if (ecg != null) {
                        Log.d("Bp2Plugin", "Successfully built EcgFile from bytes");
                    } else {
                        Log.w("Bp2Plugin", "Failed to build EcgFile from bytes");
                    }
                }
            }

            if (ecg == null) {
                Log.w("Bp2Plugin", "No EcgFile available to read recording time");
                return null;
            }

            for (String name : new String[]{"getRecordingTime", "getRecordTime", "getDuration", "getTime"}) {
                try {
                    java.lang.reflect.Method m = ecg.getClass().getMethod(name);
                    Object r = m.invoke(ecg);
                    if (r instanceof Number) {
                        int time = ((Number) r).intValue();
                        Log.d("Bp2Plugin", "SUCCESS: Found recording time via " + name + ": " + time + " seconds");
                        return time;
                    }
                } catch (Throwable ignore) {}
            }
        } catch (Throwable t) {
            Log.e("Bp2Plugin", "getRecordingTime fatal", t);
        }
        return null;
    }

    private void resolveEcg(PluginCall call, short[] shorts, float[] floats, int sampleRate, Integer durationSec) {
        if (shorts != null && shorts.length > 0) {
            String base64 = shortsToBase64(shorts);
            JSObject ret = new JSObject();
            ret.put("base64Int16", base64);
            ret.put("sampleRate", sampleRate);
            ret.put("scaleUvPerLsb", 3.098);
            if (durationSec != null) ret.put("durationSec", durationSec);
            call.resolve(ret);
            return;
        }
        if (floats != null && floats.length > 0) {
            JSArray arr = new JSArray();
            try {
                for (float v : floats) arr.put(v);
            } catch (Exception e) {
                Log.e("Bp2Plugin", "Error adding float values to JSArray", e);
                call.reject("Error processing float data");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("mvFloats", arr);
            ret.put("sampleRate", sampleRate);
            ret.put("scaleUvPerLsb", 1.0);   // floats are already in mV
            if (durationSec != null) ret.put("durationSec", durationSec);
            call.resolve(ret);
            return;
        }
        call.reject("No ECG wave data found in any format");
    }

    private String shortsToBase64(short[] data) {
        ByteBuffer bb = ByteBuffer.allocate(data.length * 2).order(ByteOrder.LITTLE_ENDIAN);
        for (short s : data) bb.putShort(s);
        return android.util.Base64.encodeToString(bb.array(), android.util.Base64.NO_WRAP);
    }

    private Object buildEcgFileFromBytes(byte[] content, boolean bp2w) {
        if (content == null || content.length == 0) return null;

        String[] candidates = bp2w
            ? new String[] { "com.lepu.blepro.ext.bp2w.EcgFile", "com.lepu.blepro.ext.bp2.EcgFile" }
            : new String[] { "com.lepu.blepro.ext.bp2.EcgFile", "com.lepu.blepro.ext.bp2w.EcgFile" };

        for (String fqcn : candidates) {
            try {
                Class<?> ecgCls = Class.forName(fqcn);

                // A) new EcgFile(byte[])
                try {
                    var c = ecgCls.getDeclaredConstructor(byte[].class);
                    c.setAccessible(true);
                    Object ecg = c.newInstance((Object) content);
                    Log.d("Bp2Plugin", "EcgFile(byte[]) -> " + fqcn);
                    return ecg;
                } catch (Throwable ignore) {}

                // B) Static methods that return EcgFile and accept byte[] or (byte[],int,...) 
                for (var m : ecgCls.getMethods()) {
                    if (!java.lang.reflect.Modifier.isStatic(m.getModifiers())) continue;
                    if (!ecgCls.isAssignableFrom(m.getReturnType())) continue;
                    var params = m.getParameterTypes();
                    if (params.length >= 1 && params[0] == byte[].class) {
                        try {
                            Object ecg;
                            if (params.length == 1) {
                                ecg = m.invoke(null, (Object) content);
                            } else if (params.length == 2 && params[1] == int.class) {
                                ecg = m.invoke(null, content, content.length);
                            } else if (params.length == 3 && params[1] == int.class && params[2] == int.class) {
                                ecg = m.invoke(null, content, 0, content.length);
                            } else {
                                continue;
                            }
                            if (ecg != null) {
                                Log.d("Bp2Plugin", "static " + m.getName() + "(bytes...) -> " + fqcn);
                                return ecg;
                            }
                        } catch (Throwable ignore) {}
                    }
                }

                // C) Instance parse/decode methods: new EcgFile(); ecg.parse/decode(...)
                try {
                    Object ecg = ecgCls.getDeclaredConstructor().newInstance();
                    for (var m : ecgCls.getMethods()) {
                        var name = m.getName();
                        if (!(name.equals("parse") || name.equals("decode") || name.equals("fromBytes") || name.equals("load"))) continue;
                        var params = m.getParameterTypes();
                        if (params.length >= 1 && params[0] == byte[].class) {
                            try {
                                if (params.length == 1) {
                                    m.invoke(ecg, (Object) content);
                                } else if (params.length == 2 && params[1] == int.class) {
                                    m.invoke(ecg, content, content.length);
                                } else if (params.length == 3 && params[1] == int.class && params[2] == int.class) {
                                    m.invoke(ecg, content, 0, content.length);
                                } else {
                                    continue;
                                }
                                Log.d("Bp2Plugin", "instance " + name + "(bytes...) -> " + fqcn);
                                return ecg;
                            } catch (Throwable ignore) {}
                        }
                    }
                } catch (Throwable ignore) {}

                // D) Kotlin Companion.*(bytes…)
                try {
                    var comp = ecgCls.getField("Companion").get(null);
                    if (comp != null) {
                        for (var m : comp.getClass().getMethods()) {
                            var params = m.getParameterTypes();
                            if (params.length >= 1 && params[0] == byte[].class) {
                                try {
                                    Object ecg;
                                    if (params.length == 1) {
                                        ecg = m.invoke(comp, (Object) content);
                                    } else if (params.length == 2 && params[1] == int.class) {
                                        ecg = m.invoke(comp, content, content.length);
                                    } else if (params.length == 3 && params[1] == int.class && params[2] == int.class) {
                                        ecg = m.invoke(comp, content, 0, content.length);
                                    } else {
                                        continue;
                                    }
                                    if (ecg != null && ecgCls.isInstance(ecg)) {
                                        Log.d("Bp2Plugin", "Companion." + m.getName() + "(bytes...) -> " + fqcn);
                                        return ecg;
                                    }
                                } catch (Throwable ignore) {}
                            }
                        }
                    }
                } catch (Throwable ignore) {}

                // Debug aid: list public methods once if nothing matched
                Log.d("Bp2Plugin", "No parser matched in " + fqcn + ". Public methods:");
                for (var m : ecgCls.getMethods()) {
                    Log.d("Bp2Plugin", "  " + m);
                }
            } catch (Throwable ignore) {}
        }
        Log.w("Bp2Plugin", "buildEcgFileFromBytes: no EcgFile parser/ctor found");
        return null;
    }
}
