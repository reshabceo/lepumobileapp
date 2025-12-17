# ECG Waveform Display Root Cause Analysis

## Problem
ECG waveform appears as flat green lines on top of x-axis, not showing proper deflections above and below baseline.

## Data Flow Analysis

### 1. iOS Plugin → JavaScript
- **iOS Plugin** (`WellueSDKPlugin.swift`):
  - Parses ECG file using `VTMBLEParser.parseECGResult()` and `parseBPPoints()`
  - Sends raw Int16 samples: `ecgPointsArray: [Int]` (Int16 values: -32768 to 32767)
  - Sends scale: `scaleUvPerLsb: 3.098` (μV/LSB)
  - Sends sample rate: `sampleRate: 125` (Hz)
  - ✅ **CORRECT**: Matches Android/web portal format

### 2. JavaScript Bridge → React Component
- **Bridge** (`wellue-sdk-bridge.ts`):
  - Receives `ecgData` event with `ecgData: [Int16]`, `scaleUvPerLsb: 3.098`, `sampleRate: 125`
  - Forwards to `onECGData` callback
  - ✅ **CORRECT**: Passes raw Int16 samples

### 3. React Component → Chart
- **ECGMonitor.tsx**:
  - Receives raw Int16 samples in `ecgResult.ecgData`
  - Converts to Float32Array: `samplesArray[i] = rawSamples[i]` (line 487)
  - Sets chart data: `{ s: Float32Array, sr: 125, scale: 3.098 }`
  - ⚠️ **ISSUE**: Float32Array contains raw Int16 values (correct), but scale is 3.098 (not 1.0)

### 4. Chart Component → Canvas
- **EcgChartWithControls.tsx**:
  - Passes `scaleUvPerLsb={ecgData.scale}` (3.098) to `EcgStripCanvas`
  - ✅ **CORRECT**: Passes scale value

- **EcgStripCanvas.tsx**:
  - `convertToMv()` function:
    ```typescript
    if (scaleUvPerLsb === 1.0) {
      return sample; // Already in mV
    } else {
      return (sample * scaleUvPerLsb) / 1000; // Convert μV to mV
    }
    ```
  - For `scaleUvPerLsb = 3.098`:
    - Converts: `(sample * 3.098) / 1000` = sample * 0.003098 mV
    - Example: sample = 1000 → 3.098 mV ✅ **CORRECT**
  
  - **Baseline centering** (lines 89-93):
    ```typescript
    const mvSamples = Array.from(rowData).map(sample => convertToMv(sample));
    const minMv = Math.min(...mvSamples);
    const maxMv = Math.max(...mvSamples);
    const midMv = (minMv + maxMv) / 2; // Baseline
    const ampMv = Math.max(0.5, maxMv - minMv); // Amplitude range
    ```
    - ✅ **CORRECT**: Calculates midpoint for centering
  
  - **Waveform drawing** (lines 168-174):
    ```typescript
    const sampleMv = convertToMv(rowData[i]);
    const centeredMv = sampleMv - midMv;
    const y = rowY + (rowHeight / 2) - (centeredMv * amplitudeScale);
    ```
    - ✅ **CORRECT**: Centers waveform around baseline

## Root Cause

### Issue 1: Data May Be All Zeros or Invalid
- If iOS plugin sends all zeros or empty array, waveform will be flat
- **Check**: iOS plugin logs show `nonZeroCount` - if this is 0, data is invalid

### Issue 2: Scale Check Logic Issue
- `convertToMv` checks `if (scaleUvPerLsb === 1.0)` for "already in mV"
- But we're passing `scale: 3.098`, so it should convert
- **However**: If data was already converted to mV somewhere, passing `scale: 1.0` would skip conversion
- **Current**: We pass `scale: 3.098` (correct for raw Int16)

### Issue 3: Web Portal Comparison
- **Web Portal** (`HealthDashboard.tsx` lines 604-614):
  ```typescript
  const values = waveformData.map((c) => (c as number) * mvPerCount);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const mid = (minV + maxV) / 2;
  const amp = Math.max(0.5, maxV - minV);
  const y = cssH * 0.5 - ((values[i] - mid) / amp) * (cssH * 0.4);
  ```
  - **Key difference**: Web portal normalizes by amplitude: `(values[i] - mid) / amp`
  - **Current implementation**: Uses amplitude scale: `(centeredMv * amplitudeScale)`
  - Both should work, but normalization might be more robust

### Issue 4: Data Type Mismatch
- **iOS sends**: `[Int]` (Int16 values)
- **ECGMonitor converts to**: `Float32Array` (but values are still Int16)
- **EcgStripCanvas expects**: `Int16Array | Float32Array`
- **Issue**: Float32Array with Int16 values might cause precision issues
- **Better**: Use Int16Array directly, or convert to mV Float32Array

## Solution

### Fix 1: Convert to mV in ECGMonitor (Match Web Portal)
- Convert raw Int16 samples to mV Float32Array in `ECGMonitor.tsx`
- Pass `scale: 1.0` to chart (already in mV)
- This matches web portal approach

### Fix 2: Use Int16Array Directly
- Keep raw Int16 samples as Int16Array
- Pass to chart with `scale: 3.098`
- Chart converts using `convertToMv`

### Fix 3: Add Data Validation
- Check if data is all zeros or empty
- Log sample statistics (min, max, non-zero count)
- Show error if data is invalid

## Recommended Fix

**Option A (Match Web Portal)**: Convert to mV in ECGMonitor, pass `scale: 1.0`
- Pros: Matches web portal exactly, simpler chart logic
- Cons: Loses raw data, requires conversion

**Option B (Keep Raw)**: Use Int16Array, pass `scale: 3.098`
- Pros: Preserves raw data, matches Android
- Cons: Chart must handle conversion

**Recommended**: **Option A** - Convert to mV in ECGMonitor to match web portal exactly.


