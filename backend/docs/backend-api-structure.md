# Medical Device Backend API Structure

## Core API Endpoints

### Device Management
```
GET    /api/devices                     # List available devices
GET    /api/devices/{deviceId}          # Get device info
POST   /api/devices/{deviceId}/connect  # Connect to device
DELETE /api/devices/{deviceId}/connect  # Disconnect device
GET    /api/devices/{deviceId}/status   # Get connection status
```

### Blood Pressure Monitors (BP2, BP3, AirBP)
```
POST   /api/bp/{deviceId}/start-measurement    # Start BP measurement
POST   /api/bp/{deviceId}/stop-measurement     # Stop BP measurement
GET    /api/bp/{deviceId}/real-time           # Get real-time pressure data
GET    /api/bp/{deviceId}/results             # Get measurement results
GET    /api/bp/{deviceId}/config              # Get device configuration
POST   /api/bp/{deviceId}/config              # Set device configuration
```

### ECG Devices (ER1, ER2, ER3)
```
POST   /api/ecg/{deviceId}/start-recording     # Start ECG recording
POST   /api/ecg/{deviceId}/stop-recording      # Stop ECG recording
GET    /api/ecg/{deviceId}/real-time          # Get real-time ECG data
GET    /api/ecg/{deviceId}/files              # List ECG files
GET    /api/ecg/{deviceId}/files/{filename}   # Download ECG file
DELETE /api/ecg/{deviceId}/files/{filename}   # Delete ECG file
```

### Pulse Oximeters (PC-60FW, O2Ring, SP20)
```
GET    /api/oximeter/{deviceId}/real-time     # Get SpO2, PR, PI data
GET    /api/oximeter/{deviceId}/waveform      # Get pulse waveform
GET    /api/oximeter/{deviceId}/sleep-data    # Get sleep monitoring data
GET    /api/oximeter/{deviceId}/config       # Get oximeter settings
POST   /api/oximeter/{deviceId}/config       # Update oximeter settings
```

### Blood Glucose Meters
```
POST   /api/glucose/{deviceId}/measure        # Start glucose measurement
GET    /api/glucose/{deviceId}/latest         # Get latest reading
GET    /api/glucose/{deviceId}/history        # Get measurement history
```

## WebSocket Events for Real-time Data

### Connection Events
- `device_connected`
- `device_disconnected` 
- `device_error`

### Blood Pressure Events
- `bp_real_time_pressure`    # Real-time pressure during measurement
- `bp_measurement_complete`  # Final BP results
- `bp_measurement_error`     # Measurement errors

### ECG Events
- `ecg_real_time_data`       # Real-time ECG waveform (125-250Hz)
- `ecg_heart_rate`           # Heart rate updates
- `ecg_lead_off`             # Lead disconnection alerts

### Pulse Oximeter Events  
- `oxy_real_time_params`     # SpO2, PR, PI values (1Hz)
- `oxy_waveform_data`        # Pulse waveform (50Hz)
- `oxy_battery_status`       # Battery level updates

### Glucose Meter Events
- `glucose_countdown`        # Measurement countdown
- `glucose_result`           # Glucose reading result

## Data Models

### Device Status
```json
{
  "deviceId": "string",
  "model": "BP2|ER1|PC60FW|etc",
  "name": "string", 
  "macAddress": "string",
  "connected": boolean,
  "battery": {
    "level": "number (0-100)",
    "status": "charging|normal|low"
  },
  "lastSeen": "timestamp"
}
```

### Blood Pressure Result
```json
{
  "timestamp": "ISO8601",
  "systolic": "number",
  "diastolic": "number", 
  "mean": "number",
  "pulseRate": "number",
  "result": "normal|error",
  "errorCode": "number",
  "errorMessage": "string"
}
```

### ECG Data
```json
{
  "timestamp": "ISO8601",
  "samplingRate": "number (Hz)",
  "waveformData": "number[]",
  "heartRate": "number",
  "leadOff": boolean,
  "diagnosis": {
    "isRegular": boolean,
    "isFastHr": boolean,
    "isSlowHr": boolean,
    "isIrregular": boolean
  }
}
```

### Pulse Oximeter Data
```json
{
  "timestamp": "ISO8601",
  "spo2": "number (0-100)",
  "pulseRate": "number (0-511)", 
  "pi": "number (0-25.5)",
  "probeOff": boolean,
  "pulseSearching": boolean,
  "waveform": "number[]"
}
```

### Glucose Reading
```json
{
  "timestamp": "ISO8601",
  "value": "number",
  "unit": "mg/dL|mmol/L",
  "result": "normal|low|high",
  "deviceInfo": {
    "model": "string",
    "battery": "number"
  }
}
```