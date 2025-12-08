# Simplified BP Measurement Detection - Clean Approach

## Problem Summary
The current implementation has 7+ conflicting mechanisms trying to detect measurement completion, causing:
- RT timer stops responding after a few readings
- Pressure stability detection never triggers (no data to detect)
- Multiple timers interfering with each other
- Device Bluetooth stack gets overwhelmed

## Root Cause
**Polling too fast (10 Hz) overwhelms the BP2A device's Bluetooth stack**, causing it to stop responding to `requestBPRealData()` commands while still responding to status requests.

## The Simple Solution

### ✅ ONE MECHANISM: Status-Only Polling

```
Poll device status every 1 second (not 0.1s!)
├─ Status 3 (ready) → Idle
├─ Status 4 (measuring) → Start UI, track time
├─ Status 5 (complete) → Read file, show results
└─ Status 4 for >60s → Timeout, read file anyway
```

### Why This Works
1. **Slower polling (1s)** → Device can handle it
2. **Status-only** → Lighter on Bluetooth
3. **Single source of truth** → No conflicts
4. **Simple timeout** → 60s max per measurement
5. **File-based results** → Most reliable

## Implementation

### Step 1: Remove ALL Complex Logic
- ❌ Remove RT timer (0.1s polling)
- ❌ Remove pressure stability detection
- ❌ Remove aggressive result polling
- ❌ Remove 180s timeout
- ❌ Remove result query retries

### Step 2: Keep ONLY Simple Status Polling
```swift
// Single timer: Check status every 1 second
statusTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
    self?.viatomUtils?.bp_requestRealStatus()
}
```

### Step 3: Handle Status Changes
```swift
func handleStatusUpdate(_ status: VTMBPRunStatus) {
    switch status.status {
    case 3: // Ready
        resetMeasurement()
    case 4: // Measuring
        if !isMeasuring {
            startMeasurement()
        }
        checkMeasurementTimeout() // If measuring for >60s, force complete
    case 5: // Complete
        completeMeasurement()
    default:
        break
    }
}
```

### Step 4: Timeout Detection
```swift
func checkMeasurementTimeout() {
    guard let startTime = measurementStartTime else { return }
    let elapsed = Date().timeIntervalSince(startTime)
    
    if elapsed > 60.0 {
        logWarn("Measurement timeout after 60s - forcing completion")
        completeMeasurement()
    }
}
```

### Step 5: Read Results
```swift
func completeMeasurement() {
    isMeasuring = false
    readLatestStoredBPMeasurement() // Always read from file
    requestChangeBPState(0) // Clear device
}
```

## Benefits
- ✅ **Reliable**: Device never gets overwhelmed
- ✅ **Simple**: ONE mechanism, easy to debug
- ✅ **Fast**: 60s timeout catches stuck states
- ✅ **Robust**: File-based results always work
- ✅ **Clean**: No conflicting timers

## Expected Flow
```
1. User presses device button
2. Status changes 3→4 (app detects within 1s)
3. UI shows "measuring" + pressure animation (simulated)
4. Device completes (~30-40s)
5. Status changes 4→5 OR stays 4 for 60s
6. App reads BP file from device
7. Results displayed
8. Device cleared, ready for next
```

## No More
- ❌ Complex RT timer logic
- ❌ Pressure data polling (unreliable)
- ❌ Multiple completion paths
- ❌ Conflicting timers
- ❌ Device Bluetooth overload

## Result
**Simple, reliable, debuggable BP measurement detection that ACTUALLY WORKS.**

