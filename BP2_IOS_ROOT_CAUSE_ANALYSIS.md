# BP2 iOS Root Cause Analysis

## Issues Identified

### 1. **CRITICAL: Real-time Callback Not Receiving Data** ❌

**Symptom:**
```
📊 [BP2RT BRIDGE] Raw native data: {"pressure":22528,"pulse":15...}
📊 [BP2RT BRIDGE] ❌ onRealTimeUpdate callback not set!
```

**Root Cause:**
- In `LiveBPMonitorRevamped.tsx` lines 630-651: Callbacks are registered ONCE at component mount
- `handleRealTimeUpdate` is a `useCallback` (line 532-610) with dependencies `[measurementState, targetPressure]`
- When callbacks are registered, they capture the INITIAL state values (likely `measurementState = 'idle'`)
- Later state changes don't trigger callback re-registration
- The SDK bridge receives data but calls a stale callback with outdated state references

**Evidence from Logs:**
- Device sends data: `pressure: 22528` (225 mmHg), `pulse: 15`
- Bridge maps it correctly: `pressure: 225, heartRate: 15`
- But callback check fails: `onRealTimeUpdate exists: false`

**Why This Breaks:**
- The real-time data never reaches the component
- Measurement state never updates beyond 'idle'
- Pressure visualizations don't animate
- Results aren't captured

---

### 2. **Smart Connect Not Finding Devices** ❌

**Symptom:**
```
🔍 [EVENT LISTENERS] Device found: BP2 3049
❌ No devices found on attempt 1, retrying...
```

**Root Cause:**
- `HealthDashboard.tsx` line 868: Checks `availableDevices.length === 0`
- Native plugin IS finding devices (logs show 100+ device discovery events)
- BUT `availableDevices` array in component state stays empty
- In `DeviceContext.tsx` line 294-304: `onDeviceFound` callback is set ONLY during SDK initialization
- If SDK was already initialized, `startScan()` doesn't re-register the callback
- Device events fire but nobody is listening

**Evidence from Logs:**
- Native events firing continuously: `🔍 [EVENT LISTENERS] Device found event received`
- Processed device objects created: `{id: "1E3E5FD6-D647-14C7-1D34-BBE5BDB80250", name: "BP2 3049"...}`
- Component still reports: "No devices found after multiple scan attempts"

**Why This Breaks:**
- User can see device is nearby (Bluetooth discovers it)
- But app says "no devices found"
- Forces user to use manual scan and connect

---

### 3. **Connection State Timing Issue** ⚠️

**Symptom:**
- First button press: Connection happens in background
- UI shows "not connected"
- Second press: UI finally shows "connected"

**Root Cause:**
- State updates are async
- Connection callback fires but React state update batching causes delay
- Button disabled state doesn't account for "connecting" phase properly

---

## Solutions Required

### Solution 1: Fix Real-time Callback Registration

**Option A: Use Refs for Latest State (Recommended)**
```typescript
const measurementStateRef = useRef(measurementState);
const targetPressureRef = useRef(targetPressure);

useEffect(() => {
  measurementStateRef.current = measurementState;
  targetPressureRef.current = targetPressure;
}, [measurementState, targetPressure]);

const handleRealTimeUpdate = useCallback((data: any) => {
  // Use refs instead of state variables
  const currentState = measurementStateRef.current;
  const currentTarget = targetPressureRef.current;
  // ... rest of logic
}, []); // No dependencies - callback never recreated
```

**Option B: Re-register Callbacks When They Change**
```typescript
useEffect(() => {
  if (!wellueSDK || !isInitialized) return;
  
  wellueSDK.setCallbacks({
    onRealTimeUpdate: handleRealTimeUpdate,
    // ... other callbacks
  });
}, [wellueSDK, isInitialized, handleRealTimeUpdate]); // Add callback dependencies
```

---

### Solution 2: Fix Smart Connect Device Discovery

**Fix DeviceContext to Always Set Callback:**
```typescript
const startScan = async () => {
  try {
    setIsScanning(true);
    setError(null);
    setAvailableDevices([]); // Clear old devices

    // ALWAYS set the device found callback, not just during init
    wellueSDK.setCallbacks({
      onDeviceFound: (device: WellueDevice) => {
        console.log('🔍 Device found during scan:', device.name);
        setAvailableDevices(prev => {
          const exists = prev.some(d => d.id === device.id);
          if (!exists) {
            return [...prev, device];
          }
          return prev;
        });
      },
      // Keep existing callbacks
      ...wellueSDK.getCallbacks()
    });

    await wellueSDK.startScan();
  } catch (error) {
    // ... error handling
  }
};
```

---

### Solution 3: Fix Connection State Tracking

**Add Proper Loading States:**
```typescript
const [connectionState, setConnectionState] = useState<'idle' | 'checking' | 'connecting' | 'connected' | 'failed'>('idle');

// In Smart Connect button handler:
try {
  setConnectionState('checking');
  // ... SDK init
  
  setConnectionState('connecting');
  await connectToDevice(bp2Device);
  
  // Wait for state confirmation
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (connectedDevice) {
    setConnectionState('connected');
  }
} catch (error) {
  setConnectionState('failed');
}
```

---

## Testing Checklist After Fixes

- [ ] Real-time data appears in logs with "✅" not "❌"
- [ ] Pressure visualization animates during measurement
- [ ] Smart Connect finds device on first attempt
- [ ] No "No devices found" error when device is nearby
- [ ] Single button press connects successfully
- [ ] Connection state reflects actual connection status
- [ ] Measurement results are captured and displayed

---

## Priority

1. **P0 (Critical)**: Fix real-time callback - This blocks ALL measurement functionality
2. **P0 (Critical)**: Fix Smart Connect device discovery - This blocks user onboarding
3. **P1 (High)**: Fix connection state timing - This causes user confusion


