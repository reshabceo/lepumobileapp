# Lepu Medical Device API

A comprehensive backend API for communicating with Lepu medical devices via Bluetooth Low Energy (BLE). Supports blood pressure monitors, ECG devices, pulse oximeters, and blood glucose meters.

## 🏥 **Supported Devices**

- **Blood Pressure Monitors**: BP2, BP3, AirBP, BPM-188
- **ECG Devices**: ER1, ER2, ER3, PC-80B, PC-300
- **Pulse Oximeters**: PC-60FW, O2Ring, SP20, PF-10AW
- **Blood Glucose Meters**: Bioland-BGM, LPM311

## 🚀 **Quick Start**

### Prerequisites

- Node.js 16+ 
- Bluetooth 4.0+ (BLE support)
- Compatible Lepu medical devices

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp env.example .env

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000`

## 📋 **API Endpoints**

### Device Management
```
GET    /api/devices                     # List discovered devices
POST   /api/devices/{id}/connect        # Connect to device
DELETE /api/devices/{id}/connect        # Disconnect device
GET    /api/devices/{id}/status         # Get device status
POST   /api/devices/scan/start          # Start device scanning
POST   /api/devices/scan/stop           # Stop device scanning
```

### Blood Pressure Monitors
```
POST   /api/bp/{id}/start-measurement   # Start BP measurement
POST   /api/bp/{id}/stop-measurement    # Stop BP measurement
GET    /api/bp/{id}/real-time          # Get real-time pressure data
GET    /api/bp/{id}/history            # Get measurement history
GET    /api/bp/{id}/config             # Get device configuration
POST   /api/bp/{id}/config             # Set device configuration
```

### ECG Devices
```
POST   /api/ecg/{id}/start-recording    # Start ECG recording
POST   /api/ecg/{id}/stop-recording     # Stop ECG recording
GET    /api/ecg/{id}/real-time         # Get real-time ECG data
GET    /api/ecg/{id}/files             # List ECG files
GET    /api/ecg/{id}/files/{filename}  # Download ECG file
DELETE /api/ecg/{id}/files/{filename}  # Delete ECG file
GET    /api/ecg/{id}/analysis          # Get ECG analysis
```

### Pulse Oximeters
```
GET    /api/oximeter/{id}/real-time     # Get SpO2, PR, PI data
GET    /api/oximeter/{id}/waveform      # Get pulse waveform
GET    /api/oximeter/{id}/sleep-data    # Get sleep monitoring data
GET    /api/oximeter/{id}/config       # Get oximeter settings
POST   /api/oximeter/{id}/config       # Update oximeter settings
GET    /api/oximeter/{id}/history      # Get measurement history
```

### Blood Glucose Meters
```
POST   /api/glucose/{id}/measure        # Start glucose measurement
GET    /api/glucose/{id}/latest         # Get latest reading
GET    /api/glucose/{id}/history        # Get measurement history
GET    /api/glucose/{id}/info          # Get device info
POST   /api/glucose/{id}/unit          # Set measurement unit
```

## 🔄 **Real-time Communication (WebSocket)**

Connect to WebSocket for real-time device data:

```javascript
const socket = io('http://localhost:3000');

// Device events
socket.on('device_discovered', (device) => {
    console.log('New device:', device.name, device.model);
});

socket.on('device_connected', (data) => {
    console.log('Device connected:', data.deviceId);
});

// Blood pressure events
socket.on('bp_real_time_pressure', (data) => {
    console.log('BP Pressure:', data.pressure, 'mmHg');
});

socket.on('bp_measurement_complete', (data) => {
    console.log('BP Result:', data.systolic + '/' + data.diastolic);
});

// ECG events
socket.on('ecg_real_time_data', (data) => {
    console.log('ECG HR:', data.heartRate, 'bpm');
    // Process ECG waveform: data.waveformData
});

// Pulse oximeter events
socket.on('oxy_real_time_params', (data) => {
    console.log('SpO2:', data.spo2 + '%', 'PR:', data.pulseRate);
});

// Glucose meter events
socket.on('glucose_result', (data) => {
    console.log('Glucose:', data.value, data.unit);
});
```

## 📊 **Example Usage**

### Connect and Measure Blood Pressure

```javascript
// 1. Start device scanning
await fetch('/api/devices/scan/start', { method: 'POST' });

// 2. Get discovered devices
const devices = await fetch('/api/devices').then(r => r.json());
const bpDevice = devices.devices.find(d => d.model.includes('BP'));

// 3. Connect to device
await fetch(`/api/devices/${bpDevice.id}/connect`, { method: 'POST' });

// 4. Start measurement
await fetch(`/api/bp/${bpDevice.id}/start-measurement`, { method: 'POST' });

// 5. Listen for real-time data via WebSocket
socket.on('bp_real_time_pressure', (data) => {
    console.log('Current pressure:', data.pressure);
});

socket.on('bp_measurement_complete', (data) => {
    console.log('Final result:', {
        systolic: data.systolic,
        diastolic: data.diastolic,
        pulseRate: data.pulseRate
    });
});
```

### Record ECG Data

```javascript
// Connect to ECG device
await fetch(`/api/devices/${ecgDeviceId}/connect`, { method: 'POST' });

// Start 30-second recording
await fetch(`/api/ecg/${ecgDeviceId}/start-recording`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration: 30 })
});

// Listen for real-time ECG data
socket.on('ecg_real_time_data', (data) => {
    // data.waveformData contains ECG samples (125-250Hz)
    // data.heartRate contains current heart rate
    renderECGWaveform(data.waveformData);
    updateHeartRate(data.heartRate);
});
```

## 🧪 **Testing**

### Run Tests
```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Manual Testing

See [TEST_GUIDE.md](./TEST_GUIDE.md) for comprehensive testing instructions including:
- cURL examples
- Postman collection
- Web test client
- WebSocket testing

### Quick Health Check
```bash
curl http://localhost:3000/api/health
```

## 📁 **Project Structure**

```
backend/
├── src/
│   ├── app.js                 # Main application file
│   ├── controllers/           # API route handlers
│   │   ├── deviceController.js
│   │   ├── bloodPressureController.js
│   │   ├── ecgController.js
│   │   ├── oximeterController.js
│   │   └── glucoseController.js
│   ├── services/              # Business logic
│   └── utils/                 # Utilities
├── tests/                     # Test files
├── docs/                      # Documentation
│   ├── backend-api-structure.md
│   ├── SETUP_GUIDE.md
│   └── DEPLOYMENT_GUIDE.md
├── package.json
├── env.example               # Environment template
└── README.md
```

## ⚙️ **Configuration**

Copy `env.example` to `.env` and configure:

```env
# Server
PORT=3000
NODE_ENV=development

# Bluetooth
BLE_SCAN_TIMEOUT=30000
BLE_CONNECTION_TIMEOUT=10000

# Security
JWT_SECRET=your-secret-key
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=debug
```

## 🔒 **Security Features**

- JWT authentication (optional)
- Rate limiting
- CORS protection
- Input validation
- Error handling
- Logging

## 🚀 **Deployment**

### Docker
```bash
docker build -t lepu-medical-api .
docker run -p 3000:3000 lepu-medical-api
```

### Production
See [DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) for:
- Docker deployment
- AWS/Cloud deployment
- Raspberry Pi setup
- Production configuration

## 📖 **Documentation**

- [Setup Guide](./docs/SETUP_GUIDE.md) - Detailed setup instructions
- [API Structure](./docs/backend-api-structure.md) - Complete API documentation
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md) - Production deployment
- [Test Guide](./TEST_GUIDE.md) - Testing instructions

## 🐛 **Troubleshooting**

### Common Issues

**Bluetooth Permission Issues**
- Ensure Bluetooth is enabled
- Run with administrator privileges if needed
- Check device permissions

**Device Not Found**
- Ensure device is in pairing mode
- Check device is within range
- Verify device model is supported

**Connection Failed**
- Device may already be connected to another app
- Try restarting the device
- Check Bluetooth stack

### Debug Mode
```bash
LOG_LEVEL=debug npm run dev
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 **License**

MIT License - see LICENSE file for details

## 🏥 **Medical Device Compliance**

This software is for development and testing purposes. For medical use, ensure compliance with:
- FDA regulations (if applicable)
- CE marking requirements
- Local medical device regulations
- Data privacy laws (HIPAA, GDPR)

## 📞 **Support**

For questions or issues:
- Check the documentation in `/docs`
- Review the test guide for examples
- Open an issue on GitHub
- Contact: [your-email@domain.com]

---

**Built with ❤️ for better healthcare technology**