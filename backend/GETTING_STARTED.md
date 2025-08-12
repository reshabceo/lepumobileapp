# 🚀 Getting Started with Lepu Medical Device API

## 📁 What's Been Created

Your `backend/` folder now contains a complete Node.js API project:

```
backend/
├── 📄 package.json                 # Node.js project configuration
├── 🔧 env.example                  # Environment configuration template
├── 📖 README.md                    # Complete API documentation
├── 📋 TEST_GUIDE.md                # Comprehensive testing guide
├── 🚀 GETTING_STARTED.md           # This file!
├── 🌐 test-client.html             # Interactive web test client
│
├── src/                            # Source code
│   ├── app.js                      # Main application (from implementation guide)
│   └── controllers/                # API route handlers
│       ├── index.js                # Router setup
│       ├── deviceController.js     # Device management endpoints
│       ├── bloodPressureController.js  # BP monitor endpoints
│       ├── ecgController.js        # ECG device endpoints
│       ├── oximeterController.js   # Pulse oximeter endpoints
│       └── glucoseController.js    # Glucose meter endpoints
│
├── tests/                          # Test suite
│   └── api.test.js                 # API tests with examples
│
├── scripts/                        # Utility scripts
│   └── start.js                    # Setup helper script
│
└── docs/                           # Documentation
    ├── backend-api-structure.md    # API design and data models
    ├── SETUP_GUIDE.md              # Detailed setup instructions
    └── DEPLOYMENT_GUIDE.md         # Production deployment guide
```

## ⚡ Quick Start (3 Steps)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Set Up Environment
```bash
# Copy environment template
cp env.example .env

# The .env file contains sensible defaults for development
# You can edit it if needed, but it should work out of the box
```

### 3. Start the API Server
```bash
npm run dev
```

**🎉 That's it! Your API is now running at `http://localhost:3000`**

## 🧪 Test Your API (3 Methods)

### Method 1: Quick Health Check
Open your browser and go to: `http://localhost:3000/api/health`

You should see:
```json
{
  "status": "ok",
  "timestamp": "2025-01-30T22:17:00.000Z",
  "devices": { "discovered": 0, "connected": 0 },
  "bluetooth": { "state": "poweredOn", "scanning": false }
}
```

### Method 2: Interactive Web Client
Open `test-client.html` in your browser for a complete testing interface with:
- 🔍 Device discovery
- 📊 Real-time data display
- 🩸 Blood pressure testing
- ❤️ ECG monitoring
- 🫁 Pulse oximetry
- 🩸 Glucose testing
- 📋 Real-time event logging

### Method 3: Command Line Testing
```bash
# Check API health
curl http://localhost:3000/api/health

# Start device scanning
curl -X POST http://localhost:3000/api/devices/scan/start

# Get discovered devices
curl http://localhost:3000/api/devices
```

## 📱 Supported Medical Devices

Your API supports these Lepu medical devices:

### 🩸 Blood Pressure Monitors
- **BP2, BP2A, BP2T** - Advanced BP monitors with ECG
- **BP3 Series** (BP3A-BP3Z) - Next-gen BP monitors
- **AirBP** - Wireless blood pressure monitor
- **BPM-188** - Clinical BP monitor

### ❤️ ECG Devices  
- **ER1 Series** - Portable ECG recorders
- **ER2 Series** - Advanced ECG with analysis
- **ER3** - 12-lead ECG system
- **PC-80B** - Clinical ECG device

### 🫁 Pulse Oximeters
- **PC-60FW** - Fingertip pulse oximeter
- **O2Ring** - Continuous monitoring ring
- **SP20** - Clinical pulse oximeter
- **PF-10AW** - Advanced oximeter with trends

### 🩸 Blood Glucose Meters
- **Bioland-BGM** - Smart glucose meter
- **LPM311** - Professional glucose analyzer

## 🔄 Real-time Features

Your API includes WebSocket support for real-time data:

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3000');

// Listen for device events
socket.on('device_discovered', (device) => {
    console.log('Found device:', device.name, device.model);
});

// Listen for blood pressure readings
socket.on('bp_real_time_pressure', (data) => {
    console.log('Current pressure:', data.pressure, 'mmHg');
});

// Listen for ECG data (125-250Hz sampling)
socket.on('ecg_real_time_data', (data) => {
    console.log('Heart rate:', data.heartRate, 'bpm');
    console.log('ECG samples:', data.waveformData.length);
});

// Listen for pulse oximeter readings
socket.on('oxy_real_time_params', (data) => {
    console.log('SpO2:', data.spo2 + '%', 'PR:', data.pulseRate);
});
```

## 📚 Complete API Reference

### Device Management
```
GET    /api/devices                 # List all discovered devices
POST   /api/devices/{id}/connect    # Connect to a specific device
DELETE /api/devices/{id}/connect    # Disconnect from device
GET    /api/devices/{id}/status     # Get device connection status
POST   /api/devices/scan/start      # Start Bluetooth scanning
POST   /api/devices/scan/stop       # Stop Bluetooth scanning
```

### Blood Pressure Monitors
```
POST   /api/bp/{id}/start-measurement   # Start BP measurement
POST   /api/bp/{id}/stop-measurement    # Stop BP measurement  
GET    /api/bp/{id}/real-time          # Get real-time pressure data
GET    /api/bp/{id}/history            # Get measurement history
GET    /api/bp/{id}/config             # Get device configuration
POST   /api/bp/{id}/config             # Update device settings
```

### ECG Devices
```
POST   /api/ecg/{id}/start-recording    # Start ECG recording
POST   /api/ecg/{id}/stop-recording     # Stop ECG recording
GET    /api/ecg/{id}/real-time         # Get real-time ECG data
GET    /api/ecg/{id}/files             # List stored ECG files
GET    /api/ecg/{id}/files/{filename}  # Download ECG file
DELETE /api/ecg/{id}/files/{filename}  # Delete ECG file
GET    /api/ecg/{id}/analysis          # Get AI diagnosis
```

### Pulse Oximeters
```
GET    /api/oximeter/{id}/real-time     # Get SpO2, PR, PI values
GET    /api/oximeter/{id}/waveform      # Get pulse waveform data
GET    /api/oximeter/{id}/sleep-data    # Get sleep monitoring data
POST   /api/oximeter/{id}/start-monitoring  # Start continuous monitoring
POST   /api/oximeter/{id}/stop-monitoring   # Stop monitoring
```

### Glucose Meters
```
POST   /api/glucose/{id}/measure        # Start glucose measurement
GET    /api/glucose/{id}/latest         # Get latest reading
GET    /api/glucose/{id}/history        # Get measurement history
GET    /api/glucose/{id}/info          # Get device information
POST   /api/glucose/{id}/unit          # Set unit (mg/dL or mmol/L)
```

## 🛠️ Development Commands

```bash
# Start development server (auto-reload)
npm run dev

# Start production server  
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint
```

## 📖 Documentation Files

- **README.md** - Complete API overview and examples
- **TEST_GUIDE.md** - Comprehensive testing instructions with curl, Postman, and web client examples
- **docs/SETUP_GUIDE.md** - Detailed development setup
- **docs/DEPLOYMENT_GUIDE.md** - Production deployment options (Docker, AWS, Raspberry Pi)
- **docs/backend-api-structure.md** - Complete API specification and data models

## 🔧 Configuration Options

Edit `.env` file to customize:

```env
# Server settings
PORT=3000                    # API server port
NODE_ENV=development         # Environment mode

# Bluetooth settings  
BLE_SCAN_TIMEOUT=30000      # Device scan timeout (ms)
BLE_CONNECTION_TIMEOUT=10000 # Connection timeout (ms)

# Security
JWT_SECRET=your-secret       # JWT authentication secret
RATE_LIMIT_MAX=100          # API rate limit (requests per 15min)

# Logging
LOG_LEVEL=debug             # Log level (debug, info, warn, error)
```

## 🚀 Production Deployment

When ready for production, see `docs/DEPLOYMENT_GUIDE.md` for:

- **Docker deployment** - Complete containerization
- **AWS/Cloud deployment** - Scalable cloud hosting  
- **Raspberry Pi edge deployment** - Local device communication
- **Security configuration** - JWT auth, rate limiting, HTTPS
- **Monitoring setup** - Health checks, logging, metrics

## 🆘 Need Help?

1. **Check the health endpoint**: `http://localhost:3000/api/health`
2. **Review the logs**: Look at console output when running `npm run dev`
3. **Test with the web client**: Open `test-client.html` for interactive testing
4. **Check documentation**: All guides are in the `docs/` folder
5. **Run the setup script**: `node scripts/start.js` for environment check

## 🎯 Next Steps

1. **Start the API**: `npm run dev`
2. **Open test client**: Open `test-client.html` in your browser
3. **Connect a device**: Put your Lepu device in pairing mode
4. **Start scanning**: Click "Start Scan" in the test client
5. **Select and connect**: Choose your device and click "Connect"
6. **Test functionality**: Try blood pressure, ECG, or oximeter functions
7. **View real-time data**: Watch the metrics and event log update

## 🏥 You're Ready!

Your complete medical device API is now set up and ready to communicate with Lepu devices. The API provides:

✅ **Device Discovery & Connection**  
✅ **Real-time Data Streaming**  
✅ **Complete REST API**  
✅ **WebSocket Events**  
✅ **Interactive Test Client**  
✅ **Comprehensive Documentation**  
✅ **Production Deployment Guides**  

**Happy coding with your medical device API! 🚀**