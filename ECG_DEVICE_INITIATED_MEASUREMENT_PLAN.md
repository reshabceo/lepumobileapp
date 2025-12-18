# ECG Device-Initiated Measurement Implementation Plan

## Overview
This plan outlines the implementation of device-initiated ECG measurement detection and result display for the BP2 device, mirroring the existing BP measurement flow documented in `ins.md`.

## Current State Analysis

### ✅ What Already Exists

1. **Native iOS Plugin (`WellueSDKPlugin.swift`)**:
   - ✅ Handles ECG waveform types in real-time data (type 2 = measuring, type 3 = finished)
   - ✅ Emits `ecgData` events with heart rate, duration, signal quality
   - ✅ Emits `ecgLifecycle` events with "start"/"stop" states
   - ✅ Parses `VTMECGMeasuringData` and `VTMECGEndMeasureData` structures
   - ✅ Status codes 6 (ecgMeasuring) and 7 (ecgComplete) are detected in `handleStatusUpdate`
   - ✅ `bpLifecycle` events include "ecgMeasuring" and "ecgComplete" states

2. **JS Bridge (`wellue-sdk-bridge.ts`)**:
   - ✅ `ECGData` interface defined
   - ✅ `onECGData` and `onECGLifecycle` callbacks exist
   - ✅ Native `ecgData` and `ecgLifecycle` listeners are wired

3. **ECG Monitor UI (`ECGMonitor.tsx`)**:
   - ✅ Exists and handles `ecgData` and `ecgLifecycle` events
   - ✅ Displays real-time ECG waveform
   - ✅ Processes ECG results

### ❌ What's Missing

1. **Device-Initiated Detection**:
   - ❌ No detection of status 6 (ECG measuring) when user presses device button
   - ❌ No automatic transition to ECG monitoring state when device starts ECG
   - ❌ ECG monitor doesn't detect device-initiated starts (only app-initiated)

2. **Result Display & Persistence**:
   - ❌ ECG results from device-initiated measurements may not be properly saved
   - ❌ No dedicated result display screen for ECG (similar to BP results card)
   - ❌ Results may not appear in ViewReports after device-initiated measurement

3. **Status Code Handling**:
   - ❌ `handleRealTimeUpdate` in ECGMonitor doesn't check for `deviceStatus === 6` (ECG measuring)
   - ❌ No handling of `deviceStatus === 7` (ECG complete) to trigger result display

## Implementation Plan

### Phase 1: Native Layer - Ensure Status Codes Are Emitted

**File**: `ios/App/App/WellueSDKPlugin.swift`

**Current State**: Status codes 6 and 7 are already detected in `handleStatusUpdate` and emit `bpLifecycle` events.

**Action Required**: 
- ✅ **VERIFY** that `bpLifecycle` events with "ecgMeasuring" and "ecgComplete" are being emitted
- ✅ **VERIFY** that `bp2Rt` events include `status: 6` or `status: 7` when ECG is active
- ✅ **ENSURE** `ecgLifecycle` events are emitted when status transitions to 6 or 7

**Changes Needed**:
1. In `handleStatusUpdate`, when `status.status == 6`:
   - Emit `bpLifecycle` with state "ecgMeasuring" (already done)
   - Emit `ecgLifecycle` with state "start" (if not already emitted)
   - Ensure `bp2Rt` includes `status: 6`

2. In `handleStatusUpdate`, when `status.status == 7`:
   - Emit `bpLifecycle` with state "ecgComplete" (already done)
   - Emit `ecgLifecycle` with state "stop" (already done in `emitECGEnd`)
   - Ensure `bp2Rt` includes `status: 7`

**Verification Points**:
- Status 6 should trigger both `bpLifecycle("ecgMeasuring")` and `ecgLifecycle("start")`
- Status 7 should trigger both `bpLifecycle("ecgComplete")` and `ecgLifecycle("stop")`
- `bp2Rt` events should include `status: 6` or `status: 7` in the payload

---

### Phase 2: JS Bridge - Map Status Codes to ECG Events

**File**: `src/lib/wellue-sdk-bridge.ts`

**Current State**: 
- `bp2Rt` listener exists and maps to `onRealTimeUpdate`
- `ecgData` and `ecgLifecycle` listeners exist

**Action Required**:
1. **ENHANCE** `bp2Rt` listener to detect ECG status codes:
   - When `data.status === 6` or `data.deviceStatus === 6`:
     - Emit `onECGLifecycle("start")` if not already emitted
     - Update `RealTimeData` to include ECG-specific fields
   - When `data.status === 7` or `data.deviceStatus === 7`:
     - Emit `onECGLifecycle("stop")` if not already emitted

2. **ENHANCE** `bpLifecycle` listener to trigger ECG callbacks:
   - When `data.state === "ecgMeasuring"`:
     - Call `onECGLifecycle("start")`
   - When `data.state === "ecgComplete"`:
     - Call `onECGLifecycle("stop")`

**Changes Needed**:
```typescript
// In setupEventListeners(), enhance bp2Rt listener:
this.nativePlugin.addListener('bp2Rt', (data: any) => {
    const rtData: RealTimeData = {
        // ... existing fields ...
        deviceStatus: data?.deviceStatus || data?.status,
        status: data?.status || data?.deviceStatus,
        // ... rest of fields ...
    };

    // 🆕 NEW: Detect ECG status codes
    const deviceStatus = rtData.deviceStatus || rtData.status;
    if (deviceStatus === 6) {
        // ECG measuring started on device
        this.callbacks.onECGLifecycle?.('start');
    } else if (deviceStatus === 7) {
        // ECG measuring completed on device
        this.callbacks.onECGLifecycle?.('stop');
    }

    this.callbacks?.onRealTimeUpdate?.(rtData);
});

// In setupEventListeners(), enhance bpLifecycle listener:
this.nativePlugin.addListener('bpLifecycle', (data: any) => {
    const state = data?.state;
    if (state === 'ecgMeasuring') {
        this.callbacks.onECGLifecycle?.('start');
    } else if (state === 'ecgComplete') {
        this.callbacks.onECGLifecycle?.('stop');
    }
    // ... existing handling ...
});
```

**Verification Points**:
- `onECGLifecycle("start")` should be called when device status is 6
- `onECGLifecycle("stop")` should be called when device status is 7
- `onRealTimeUpdate` should include status 6 or 7 in the data

---

### Phase 3: ECG Monitor UI - Device-Initiated Detection

**File**: `src/pages/ECGMonitor.tsx`

**Current State**: 
- Listens to `ecgData` and `ecgLifecycle` events
- Handles app-initiated ECG measurements
- Does NOT detect device-initiated measurements

**Action Required**:
1. **ADD** `onRealTimeUpdate` callback to detect device status 6 (ECG measuring)
2. **ADD** logic to automatically start monitoring when status 6 is detected
3. **ADD** logic to handle status 7 (ECG complete) and trigger result processing
4. **ENSURE** results are saved when measurement completes

**Changes Needed**:

1. **Add Real-Time Update Handler** (similar to BP monitor):
```typescript
// In useEffect where callbacks are set:
wellueSDK.setCallbacks({
    // ... existing callbacks ...
    onRealTimeUpdate: handleRealTimeUpdate, // 🆕 NEW
});

// Add handler function:
const handleRealTimeUpdate = useCallback((data: RealTimeData) => {
    const deviceStatus = data.deviceStatus || data.status;
    
    // 🆕 NEW: Detect device-initiated ECG measurement (status 6)
    if (deviceStatus === 6 && !isMonitoring) {
        console.log('🎯 [ECG] Device-initiated ECG measurement detected (Status 6)');
        
        // Auto-start monitoring
        setIsMonitoring(true);
        setMonitoringStatus('active');
        ecgBufferRef.current = [];
        setBufferLen(0);
        captureActiveRef.current = true;
        captureCountsRef.current = [];
        captureStartedAtRef.current = new Date().toISOString();
        
        // Reset filters
        notchHzRef.current = 50;
        initFilters(fsRef.current, notchHzRef.current);
        nextDetectTsRef.current = Date.now() + 1500;
        
        // Clear any previous results
        setCurrentRhythm(null);
        setIsMeasurementCompleted(false);
    }
    
    // 🆕 NEW: Detect ECG completion (status 7)
    if (deviceStatus === 7 && isMonitoring) {
        console.log('✅ [ECG] Device-initiated ECG measurement completed (Status 7)');
        // The ecgLifecycle("stop") event will handle result processing
        // This is just for logging/state tracking
    }
    
    // Update heart rate if available
    if (data.heartRate && data.heartRate > 0) {
        setDeviceBpm(data.heartRate);
        setLastDeviceHeartRateTime(Date.now());
    }
}, [isMonitoring, wellueSDK]);
```

2. **Enhance ECG Lifecycle Handler** to handle device-initiated stops:
```typescript
// In existing ecgLifecycle listener, ensure results are processed:
if (state === 'stop') {
    console.log('🛑 [ECG] ECG measurement STOPPED');
    setIsMonitoring(false);
    setMonitoringStatus('listening');
    
    // 🆕 ENSURE: Process and save results (may already exist, verify)
    // ... existing result processing logic ...
    
    // 🆕 NEW: Auto-save ECG result (similar to BP auto-save)
    if (finalHeartRate && finalHeartRate > 0) {
        // Trigger result save
        processEcgInBackground();
    }
}
```

3. **Add Auto-Save Logic** (similar to BP monitor):
```typescript
// Add useEffect to auto-save ECG results when measurement completes:
useEffect(() => {
    if (isMeasurementCompleted && currentRhythm) {
        autoSaveECGResult(currentRhythm);
    }
}, [isMeasurementCompleted, currentRhythm]);

const autoSaveECGResult = useCallback(async (result: ECGRhythm) => {
    // Similar to BP auto-save in LiveBPMonitorRevamped
    // 1. Save to Supabase
    // 2. Save to localStorage
    // 3. Save to device filesystem
}, [connectedDevice]);
```

**Verification Points**:
- When user presses ECG button on device, `handleRealTimeUpdate` should detect status 6
- ECG monitoring should start automatically without app button press
- When measurement completes, results should be processed and saved
- Results should appear in ViewReports

---

### Phase 4: Result Display & Persistence

**Files**: 
- `src/pages/ECGMonitor.tsx` (result display)
- `src/pages/ViewReports.tsx` (results list)
- `src/components/EcgResultScreen.tsx` (detailed view)

**Current State**:
- ECG results are saved to localStorage and filesystem
- ViewReports displays ECG results
- EcgResultScreen shows detailed ECG charts

**Action Required**:
1. **VERIFY** ECG results are saved when device-initiated measurement completes
2. **ENSURE** results include all required fields (heartRate, rhythm, qrs, qtc, etc.)
3. **ENSURE** results appear in ViewReports after device-initiated measurement

**Changes Needed**:

1. **Enhance Auto-Save Function** in `ECGMonitor.tsx`:
```typescript
const autoSaveECGResult = useCallback(async (result: ECGRhythm) => {
    if (!result || !result.heartRate || result.heartRate <= 0) {
        console.warn('⚠️ [ECG] Invalid ECG result, skipping save');
        return;
    }

    const dataToSave = {
        ...result,
        timestamp: result.timestamp || new Date().toISOString(),
        deviceId: connectedDevice?.id || 'unknown',
        deviceName: connectedDevice?.name || 'unknown',
        measurementId: `ecg_${Date.now()}`,
        status: 'completed',
        type: 'ecg',
        // Ensure all fields from VTMECGEndMeasureData are included:
        // heartRate, result, qrs, pvcs, qtc, etc.
    };

    try {
        // 1. Save to Supabase (if available)
        // 2. Save to localStorage('storedFilesInApp')
        // 3. Save to device filesystem as JSON
    } catch (error) {
        console.error('❌ [ECG] Failed to save ECG result:', error);
    }
}, [connectedDevice]);
```

2. **Verify ViewReports** already handles ECG results (should be working):
- ✅ Already loads from localStorage('storedFilesInApp')
- ✅ Already filters for type === 'ecg'
- ✅ Already loads from device filesystem

**Verification Points**:
- ECG results are saved with all required fields
- Results appear in ViewReports after device-initiated measurement
- Results can be viewed in EcgResultScreen

---

### Phase 5: Testing & Validation

**Test Scenarios**:

1. **Device-Initiated ECG Start**:
   - Connect BP2 device
   - Press ECG button on device (not in app)
   - ✅ Verify: App detects status 6
   - ✅ Verify: ECG monitoring starts automatically
   - ✅ Verify: Real-time waveform displays

2. **Device-Initiated ECG Completion**:
   - Complete ECG measurement on device
   - ✅ Verify: App detects status 7
   - ✅ Verify: Results are processed
   - ✅ Verify: Results are saved (Supabase, localStorage, filesystem)
   - ✅ Verify: Results appear in ViewReports

3. **Result Display**:
   - Complete device-initiated ECG measurement
   - ✅ Verify: Results show heart rate, rhythm, QRS, QTC, PVCs
   - ✅ Verify: Results can be viewed in EcgResultScreen
   - ✅ Verify: Results appear in ViewReports list

4. **Edge Cases**:
   - Start ECG on device while app is on different screen
   - ✅ Verify: App detects and switches to ECG monitoring
   - Disconnect device during ECG measurement
   - ✅ Verify: App handles disconnection gracefully
   - Multiple rapid ECG measurements
   - ✅ Verify: Each measurement is saved separately

---

## Implementation Checklist

### Native Layer (iOS)
- [ ] Verify `bpLifecycle` emits "ecgMeasuring" when status 6
- [ ] Verify `bpLifecycle` emits "ecgComplete" when status 7
- [ ] Verify `ecgLifecycle` emits "start" when status 6
- [ ] Verify `ecgLifecycle` emits "stop" when status 7
- [ ] Verify `bp2Rt` includes status 6 or 7 in payload

### JS Bridge
- [ ] Add status 6 detection in `bp2Rt` listener → call `onECGLifecycle("start")`
- [ ] Add status 7 detection in `bp2Rt` listener → call `onECGLifecycle("stop")`
- [ ] Add "ecgMeasuring" detection in `bpLifecycle` listener → call `onECGLifecycle("start")`
- [ ] Add "ecgComplete" detection in `bpLifecycle` listener → call `onECGLifecycle("stop")`

### ECG Monitor UI
- [ ] Add `onRealTimeUpdate` callback to `wellueSDK.setCallbacks`
- [ ] Implement `handleRealTimeUpdate` to detect status 6 (auto-start)
- [ ] Implement `handleRealTimeUpdate` to detect status 7 (completion)
- [ ] Add auto-save logic for ECG results
- [ ] Verify results are saved to Supabase, localStorage, and filesystem

### Result Display
- [ ] Verify ECG results include all fields from `VTMECGEndMeasureData`
- [ ] Verify results appear in ViewReports
- [ ] Verify results can be viewed in EcgResultScreen

### Testing
- [ ] Test device-initiated ECG start (status 6)
- [ ] Test device-initiated ECG completion (status 7)
- [ ] Test result saving and display
- [ ] Test edge cases (disconnection, multiple measurements)

---

## Key Differences from BP Implementation

1. **Status Codes**:
   - BP: Status 4 = measuring, Status 5 = complete
   - ECG: Status 6 = measuring, Status 7 = complete

2. **Waveform Types**:
   - BP: Type 0 = measuring, Type 1 = finished
   - ECG: Type 2 = measuring, Type 3 = finished

3. **Result Structure**:
   - BP: `VTMBPEndMeasureData` (systolic, diastolic, pulse, mean)
   - ECG: `VTMECGEndMeasureData` (hr, result, qrs, pvcs, qtc)

4. **UI Components**:
   - BP: `LiveBPMonitorRevamped` with pressure bar
   - ECG: `ECGMonitor` with waveform chart

---

## Files to Modify

1. **iOS Native**:
   - `ios/App/App/WellueSDKPlugin.swift` (verify status emission)

2. **JS Bridge**:
   - `src/lib/wellue-sdk-bridge.ts` (add status detection)

3. **ECG Monitor UI**:
   - `src/pages/ECGMonitor.tsx` (add device-initiated detection)

4. **Result Display** (verify, may not need changes):
   - `src/pages/ViewReports.tsx` (verify ECG results display)
   - `src/components/EcgResultScreen.tsx` (verify detailed view)

---

## Notes

- This implementation mirrors the BP measurement flow documented in `ins.md`
- Device-initiated detection uses the same pattern: check `deviceStatus === 6` in `handleRealTimeUpdate`
- Results are saved using the same pattern as BP: Supabase → localStorage → filesystem
- No changes to BP measurement flow - ECG is completely separate

---

## Next Steps

1. **Review this plan** and get approval
2. **Implement Phase 1** (verify native status emission)
3. **Implement Phase 2** (add status detection in bridge)
4. **Implement Phase 3** (add device-initiated detection in UI)
5. **Implement Phase 4** (verify result display)
6. **Test Phase 5** (validate all scenarios)

