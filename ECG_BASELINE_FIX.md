# ECG Baseline Fix - Starting Point Issue Resolution

## Problem Identified

The ECG measurements from the app showed a significant difference in the starting point compared to actual ECG measurements. The issue was in how the baseline was calculated and displayed.

## Root Cause

### Issue 1: Incorrect Baseline Calculation
The baseline was calculated as the **midpoint between min and max** values:
```typescript
const midMv = (minMv + maxMv) / 2; // WRONG for ECG!
```

This is incorrect for ECG because:
- ECG waveforms should oscillate around a **true baseline (isoelectric line)**
- The true baseline is the **DC offset (mean/average)** of the signal, not the midpoint between peaks
- Using min/max midpoint shifts the baseline incorrectly, especially when QRS complexes are much larger than other waves

### Issue 2: Starting Point Detection
The recording might include initial noise or pre-measurement data before the actual ECG signal starts, causing a shift in the starting point.

## Solution Implemented

### Fix 1: Proper DC Offset Calculation
Changed baseline calculation to use the **actual DC offset (mean)** instead of min/max midpoint:

**Before:**
```typescript
const midMv = (minMv + maxMv) / 2; // Wrong: midpoint between peaks
```

**After:**
```typescript
// Calculate DC offset (mean) as true baseline
const sumMv = mvSamples.reduce((sum, v) => sum + v, 0);
const meanMv = sumMv / mvSamples.length; // True DC offset (baseline)

// Remove DC offset to center waveform around zero
const dcRemovedSamples = mvSamples.map(v => v - meanMv);
```

### Fix 2: Signal Start Detection
Added logic to detect the actual start of the ECG signal by analyzing variance:

```typescript
// Detect and skip initial noise/pre-measurement samples
// Find the actual start of ECG signal by detecting when signal variance increases
let signalStartIndex = 0;
if (rawSamples.length > sampleRate * 2) {
    const windowSize = Math.floor(sampleRate * 0.5); // 0.5 second windows
    let maxVariance = 0;
    let bestStartIndex = 0;
    
    // Check first 2 seconds for signal start
    for (let start = 0; start < Math.min(sampleRate * 2, rawSamples.length - windowSize); start += Math.floor(windowSize / 2)) {
        const window = rawSamples.slice(start, start + windowSize);
        const mean = window.reduce((sum, v) => sum + v, 0) / window.length;
        const variance = window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window.length;
        
        if (variance > maxVariance) {
            maxVariance = variance;
            bestStartIndex = start;
        }
    }
    
    // Use start index if variance is significant (signal detected)
    if (maxVariance > 100) {
        signalStartIndex = Math.max(0, bestStartIndex - Math.floor(sampleRate * 0.1));
    }
}
```

## Files Modified

1. **`src/components/EcgStripCanvas.tsx`**
   - Fixed baseline calculation to use DC offset (mean) instead of min/max midpoint
   - Updated waveform rendering to use DC-removed samples

2. **`src/components/EcgFinalCanvas.tsx`**
   - Fixed baseline calculation to use DC offset (mean) instead of min/max midpoint
   - Updated waveform rendering to use DC-removed samples

3. **`src/pages/ECGMonitor.tsx`**
   - Added signal start detection to skip initial noise/pre-measurement samples
   - Improved data processing to handle starting point correctly

## Expected Results

After these fixes:
1. ✅ ECG waveform will oscillate around the **true baseline (zero line)** instead of being shifted
2. ✅ Starting point will be detected correctly, skipping initial noise
3. ✅ Waveform will match the actual ECG measurement more accurately
4. ✅ QRS complexes, P waves, and T waves will be positioned correctly relative to baseline

## Testing

To verify the fix:
1. Take a new ECG measurement
2. Compare the waveform with a known good ECG (like the 12-lead ECG printout)
3. Verify:
   - Baseline is at zero (isoelectric line)
   - QRS complexes are properly positioned
   - Starting point matches the actual measurement start
   - Waveform shape matches the reference ECG

## Technical Details

### ECG Baseline Standards
- **Standard ECG gain**: 10mm/mV (1mV = 10mm on paper)
- **Standard paper speed**: 25mm/s
- **Baseline**: Should be at zero (isoelectric line) after DC removal
- **DC Offset**: Represents the average voltage level, should be removed for display

### Why Mean vs Min/Max Midpoint Matters
- **Mean (DC offset)**: Represents the actual electrical baseline of the heart
- **Min/Max midpoint**: Only represents the center of the amplitude range, not the true baseline
- **Example**: If QRS goes to +2mV and T wave goes to +0.5mV, min/max midpoint would be around +1.25mV, but the true baseline might be +0.3mV

---

**Status**: ✅ Fixed - Baseline calculation now uses proper DC offset (mean) instead of min/max midpoint

