# LepuDemo API Integration

This document describes the integration of LepuDemo medical devices into the Vital Signs Mobile View application.

## 🏥 Supported Devices

The LepuDemo integration supports the following medical devices:

### Blood Pressure Monitors
- **BP2** - BP2 Blood Pressure Monitor
- **BP3** - BP3 Blood Pressure Monitor  
- **AirBP** - AirBP Blood Pressure Monitor
- **BPM-188** - BPM-188 Blood Pressure Monitor

### ECG Devices
- **ER1** - ER1 ECG Device
- **ER2** - ER2 ECG Device
- **ER3** - ER3 ECG Device
- **PC-80B** - PC-80B ECG Device
- **PC-300** - PC-300 ECG Device

### Pulse Oximeters
- **PC-60FW** - PC-60FW Pulse Oximeter
- **O2Ring** - O2Ring Pulse Oximeter
- **SP20** - SP20 Pulse Oximeter
- **PF-10AW** - PF-10AW Pulse Oximeter

### Blood Glucose Meters
- **Bioland-BGM** - Bioland Blood Glucose Meter
- **LPM311** - LPM311 Blood Glucose Meter

## 🚀 Quick Start

### 1. Start the Backend Server

```bash
# Navigate to the backend directory
cd backend

# Install dependencies (if not already installed)
npm install

# Start the server
npm start
```

The server will be available at `http://localhost:3000`

### 2. Access the LepuDemo Interface

1. Open your web browser and navigate to `http://localhost:5173`
2. Login with the test credentials:
   - Email: `test@test.com`
   - Password: `qweqwe`
3. Navigate to "Medical Devices" from the dashboard
4. Click on the "LepuDemo Devices" section
5. Click "Manage" to access the LepuDemo interface

## 📡 API Endpoints

### Device Management

#### Get Supported Models
```http
GET /api/lepu/models
```

**Response:**
```json
{
  "success": true,
  "models": {
    "BP2": {
      "type": "BP",
      "name": "BP2 Blood Pressure Monitor",
      "serviceUUID": "0000FFE0-0000-1000-8000-00805F9B34FB"
    }
  },
  "count": 15
}
```

#### Register Device
```http
POST /api/lepu/devices/:deviceId/register
Content-Type: application/json

{
  "model": "BP2",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "name": "My BP Monitor",
  "firmware": "1.0.0",
  "battery": 85
}
```

#### Get Device Status
```http
GET /api/lepu/devices/:deviceId/status
```

#### Get Device History
```http
GET /api/lepu/devices/:deviceId/history?limit=50&type=blood_pressure
```

### Measurements

#### Blood Pressure
```http
POST /api/lepu/bp/:deviceId/measurement
Content-Type: application/json

{
  "systolic": 120,
  "diastolic": 80,
  "mean": 93,
  "pulseRate": 72,
  "unit": "mmHg"
}
```

#### ECG Data
```http
POST /api/lepu/ecg/:deviceId/data
Content-Type: application/json

{
  "heartRate": 75,
  "waveformData": [120, 121, 119, 122, 120],
  "samplingRate": 125,
  "duration": 30,
  "leadOff": false
}
```

#### Pulse Oximeter
```http
POST /api/lepu/oximeter/:deviceId/measurement
Content-Type: application/json

{
  "spo2": 98,
  "pulseRate": 72,
  "pi": 2.1,
  "probeOff": false,
  "pulseSearching": false
}
```

#### Blood Glucose
```http
POST /api/lepu/glucose/:deviceId/measurement
Content-Type: application/json

{
  "value": 110,
  "unit": "mg/dL",
  "result": "Normal",
  "testType": "fasting"
}
```

## 🔧 Frontend Integration

### TypeScript Interfaces

```typescript
// LepuDemo device interfaces
interface LepuDeviceModel {
  type: 'BP' | 'ECG' | 'OXIMETER' | 'GLUCOSE';
  name: string;
  serviceUUID: string;
}

interface LepuDevice extends Device {
  manufacturer: 'LepuDemo';
  serviceUUID: string;
  capabilities: string[];
}

interface LepuDeviceRegistration {
  model: string;
  macAddress: string;
  name?: string;
  firmware?: string;
  battery?: number;
}
```

### API Service Methods

```typescript
// Get supported LepuDemo models
const models = await apiService.getLepuModels();

// Register a LepuDemo device
const device = await apiService.registerLepuDevice(deviceId, deviceData);

// Get device status
const status = await apiService.getLepuDeviceStatus(deviceId);

// Send measurements
await apiService.sendLepuBPMeasurement(deviceId, measurement);
await apiService.sendLepuECGData(deviceId, ecgData);
await apiService.sendLepuOximeterMeasurement(deviceId, measurement);
await apiService.sendLepuGlucoseMeasurement(deviceId, measurement);
```

## 🧪 Testing

### Run Tests

```bash
# Navigate to backend directory
cd backend

# Run all tests
npm test

# Run only LepuDemo tests
npm test -- --grep "LepuDemo"
```

### Manual Testing

1. **Test Device Registration:**
```bash
curl -X POST http://localhost:3000/api/lepu/devices/test-bp-001/register \
  -H "Content-Type: application/json" \
  -d '{
    "model": "BP2",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "name": "Test BP Monitor",
    "battery": 85
  }'
```

2. **Test BP Measurement:**
```bash
curl -X POST http://localhost:3000/api/lepu/bp/test-bp-001/measurement \
  -H "Content-Type: application/json" \
  -d '{
    "systolic": 120,
    "diastolic": 80,
    "mean": 93,
    "pulseRate": 72
  }'
```

3. **Check Device Status:**
```bash
curl http://localhost:3000/api/lepu/devices/test-bp-001/status
```

## 📊 Real-time Data

The LepuDemo integration supports real-time data through WebSocket connections:

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3000');

// Listen for LepuDemo device events
socket.on('device_discovered', (device) => {
  if (device.manufacturer === 'LepuDemo') {
    console.log('LepuDemo device discovered:', device);
  }
});

socket.on('bp_measurement_complete', (data) => {
  if (data.source === 'LepuDemo') {
    console.log('LepuDemo BP measurement:', data);
  }
});
```

## 🔒 Security

- All LepuDemo endpoints require authentication (JWT token)
- Device registration is validated against supported models
- MAC addresses are validated for proper format
- All measurements are timestamped and source-tracked

## 🐛 Troubleshooting

### Common Issues

1. **Device not found:**
   - Ensure the device is registered before sending measurements
   - Check the device ID in the URL

2. **Unsupported model:**
   - Verify the model name matches exactly (case-sensitive)
   - Check the supported models list: `GET /api/lepu/models`

3. **Authentication error:**
   - Ensure you're logged in and have a valid JWT token
   - Check the Authorization header format: `Bearer <token>`

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
DEBUG=lepu:* npm start
```

## 📚 Additional Resources

- [LepuDemo GitHub Repository](https://github.com/viatom-develop/LepuDemo)
- [VTProductLib Documentation](https://github.com/viatom-dev/VTProductLib)
- [Backend API Documentation](./backend/README.md)
- [Mobile Integration Guide](./backend/MOBILE_INTEGRATION.md)

## 🤝 Contributing

To contribute to the LepuDemo integration:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This integration is part of the Vital Signs Mobile View project and follows the same license terms. 