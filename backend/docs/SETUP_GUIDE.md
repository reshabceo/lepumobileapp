# Medical Device Backend API - Complete Setup Guide

## 🚀 Quick Start

### Prerequisites

1. **Node.js Development Environment**
   ```bash
   # Install Node.js 16+ 
   # Download from: https://nodejs.org/
   node --version  # Should be 16+
   npm --version
   ```

2. **Bluetooth Low Energy Support**
   ```bash
   # Windows: Install Windows Build Tools
   npm install --global windows-build-tools
   
   # Linux: Install Bluetooth development libraries
   sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
   
   # macOS: XCode command line tools (already includes BLE support)
   xcode-select --install
   ```

3. **Hardware Requirements**
   - Computer with Bluetooth 4.0+ (BLE support)
   - Lepu medical devices for testing
   - Optional: USB Bluetooth adapter for dedicated device communication

### Step 1: Project Setup

```bash
# Create new project directory
mkdir lepu-medical-api
cd lepu-medical-api

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express socket.io @abandonware/noble cors helmet
npm install --save-dev nodemon jest supertest

# Create project structure
mkdir -p src/{controllers,models,services,utils}
mkdir -p tests
mkdir -p docs
```

### Step 2: Environment Configuration

Create `.env` file:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Bluetooth Configuration
BLE_SCAN_TIMEOUT=30000
BLE_CONNECTION_TIMEOUT=10000

# API Configuration
API_VERSION=v1
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=debug
```

Create `package.json` scripts:
```json
{
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/",
    "docs": "swagger-jsdoc -d docs/swagger.yaml -o docs/api.json src/**/*.js"
  }
}
```

### Step 3: Core Implementation

Create `src/app.js`:
```javascript
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const DeviceManager = require('./services/DeviceManager');
const routes = require('./controllers');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN,
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Device Manager
const deviceManager = new DeviceManager(io);

// Routes
app.use('/api', routes(deviceManager));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        devices: {
            discovered: deviceManager.getDeviceCount(),
            connected: deviceManager.getConnectedCount()
        }
    });
});

// WebSocket handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.emit('server_info', {
        version: process.env.npm_package_version,
        supportedDevices: deviceManager.getSupportedDevices()
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🏥 Medical Device API Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready for real-time communication`);
    console.log(`🔍 Starting Bluetooth device discovery...`);
});

module.exports = { app, server, deviceManager };
```

### Step 4: Device-Specific Implementation

Create `src/services/devices/BP2Handler.js`:
```javascript
const BaseDeviceHandler = require('./BaseDeviceHandler');

class BP2Handler extends BaseDeviceHandler {
    constructor(device, peripheral, services) {
        super(device, peripheral, services);
        this.measurementInProgress = false;
        this.currentPressure = 0;
    }

    async startMeasurement() {
        if (this.measurementInProgress) {
            throw new Error('Measurement already in progress');
        }

        const command = this.buildStartMeasurementCommand();
        await this.sendCommand(command);
        this.measurementInProgress = true;
        
        this.emit('measurement_started', {
            deviceId: this.device.id,
            timestamp: new Date().toISOString()
        });
    }

    parseBPData(data) {
        // Parse based on BP2 protocol from README.md
        const buffer = Buffer.from(data);
        
        if (buffer.length < 4) return null;

        const paramType = buffer[0];
        
        switch (paramType) {
            case 0: // BP measuring
                return this.parseRealTimePressure(buffer);
            case 1: // BP measurement complete
                return this.parseFinalResult(buffer);
            case 2: // ECG measuring (if BP2 supports ECG)
                return this.parseECGData(buffer);
            default:
                return null;
        }
    }

    parseRealTimePressure(buffer) {
        const pressure = buffer.readUInt16LE(1);
        const pulseRate = buffer.readUInt16LE(3);
        const isDeflate = !!(buffer[5] & 0x01);
        const isPulse = !!(buffer[5] & 0x02);

        this.currentPressure = pressure;

        return {
            type: 'real_time_pressure',
            pressure: pressure,
            pulseRate: pulseRate,
            isDeflate: isDeflate,
            isPulse: isPulse
        };
    }

    parseFinalResult(buffer) {
        const systolic = buffer.readUInt16LE(1);
        const diastolic = buffer.readUInt16LE(3);
        const mean = buffer.readUInt16LE(5);
        const pulseRate = buffer.readUInt16LE(7);
        const result = buffer[9];

        this.measurementInProgress = false;

        return {
            type: 'measurement_complete',
            systolic: systolic,
            diastolic: diastolic,
            mean: mean,
            pulseRate: pulseRate,
            result: this.interpretBPResult(result),
            resultCode: result
        };
    }

    interpretBPResult(code) {
        const results = {
            0: 'Normal',
            1: 'Unable to analyze (cuff too loose, inflation slow, air leakage)',
            2: 'Waveform disorder (arm movement or interference)',
            3: 'Weak signal, unable to detect pulse wave',
            4: 'Equipment error'
        };
        return results[code] || 'Unknown error';
    }

    buildStartMeasurementCommand() {
        // Build command based on BP2 protocol
        return Buffer.from([0x01, 0x00]); // Example command
    }
}

module.exports = BP2Handler;
```

### Step 5: API Controllers

Create `src/controllers/bloodPressureController.js`:
```javascript
const bloodPressureController = (deviceManager) => {
    const router = require('express').Router();

    // Start BP measurement
    router.post('/:deviceId/start-measurement', async (req, res) => {
        try {
            const deviceHandler = deviceManager.getConnectedDevice(req.params.deviceId);
            if (!deviceHandler) {
                return res.status(404).json({ 
                    error: 'Device not connected',
                    deviceId: req.params.deviceId 
                });
            }

            if (!deviceHandler.isBPDevice()) {
                return res.status(400).json({ 
                    error: 'Device does not support blood pressure measurement' 
                });
            }

            await deviceHandler.startMeasurement();
            
            res.json({ 
                success: true, 
                message: 'Blood pressure measurement started',
                deviceId: req.params.deviceId,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({ 
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Get real-time BP data
    router.get('/:deviceId/real-time', (req, res) => {
        const deviceHandler = deviceManager.getConnectedDevice(req.params.deviceId);
        if (!deviceHandler) {
            return res.status(404).json({ error: 'Device not connected' });
        }

        const currentData = deviceHandler.getCurrentBPData();
        res.json(currentData);
    });

    // Get measurement history
    router.get('/:deviceId/history', async (req, res) => {
        try {
            const deviceHandler = deviceManager.getConnectedDevice(req.params.deviceId);
            if (!deviceHandler) {
                return res.status(404).json({ error: 'Device not connected' });
            }

            const history = await deviceHandler.getMeasurementHistory();
            res.json({
                deviceId: req.params.deviceId,
                measurements: history,
                count: history.length
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};

module.exports = bloodPressureController;
```

### Step 6: Testing Setup

Create `tests/api.test.js`:
```javascript
const request = require('supertest');
const { app } = require('../src/app');

describe('Medical Device API', () => {
    describe('Health Check', () => {
        test('GET /health should return server status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'ok');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('devices');
        });
    });

    describe('Device Management', () => {
        test('GET /api/devices should return device list', async () => {
            const response = await request(app)
                .get('/api/devices')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('Blood Pressure API', () => {
        test('POST /api/bp/invalid-device/start-measurement should return 404', async () => {
            await request(app)
                .post('/api/bp/invalid-device/start-measurement')
                .expect(404);
        });
    });
});
```

### Step 7: Frontend Integration Example

Create `public/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Medical Device API Demo</title>
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <h1>Medical Device Monitor</h1>
    
    <div id="devices">
        <h2>Available Devices</h2>
        <ul id="device-list"></ul>
    </div>

    <div id="blood-pressure">
        <h2>Blood Pressure Monitor</h2>
        <button onclick="startBPMeasurement()">Start Measurement</button>
        <div id="bp-data"></div>
    </div>

    <script>
        const socket = io();
        
        socket.on('device_discovered', (device) => {
            addDeviceToList(device);
        });
        
        socket.on('bp_real_time_pressure', (data) => {
            updateBPDisplay(data);
        });
        
        socket.on('bp_measurement_complete', (data) => {
            displayFinalBPResult(data);
        });
        
        function addDeviceToList(device) {
            const list = document.getElementById('device-list');
            const item = document.createElement('li');
            item.innerHTML = `
                ${device.name} (${device.model}) 
                <button onclick="connectDevice('${device.id}')">Connect</button>
            `;
            list.appendChild(item);
        }
        
        async function connectDevice(deviceId) {
            try {
                const response = await fetch(`/api/devices/${deviceId}/connect`, {
                    method: 'POST'
                });
                const result = await response.json();
                console.log('Device connected:', result);
            } catch (error) {
                console.error('Connection failed:', error);
            }
        }
        
        async function startBPMeasurement() {
            // Get first connected BP device
            const devices = await fetch('/api/devices').then(r => r.json());
            const bpDevice = devices.find(d => d.connected && d.model.includes('BP'));
            
            if (!bpDevice) {
                alert('No BP device connected');
                return;
            }
            
            try {
                await fetch(`/api/bp/${bpDevice.id}/start-measurement`, {
                    method: 'POST'
                });
            } catch (error) {
                console.error('Measurement failed:', error);
            }
        }
    </script>
</body>
</html>
```

## 🔧 **Development Workflow**

### Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Run tests
npm test

# Watch mode for tests
npm run test:watch
```

### Testing with Devices

1. **Device Discovery**
   ```bash
   # Check discovered devices
   curl http://localhost:3000/api/devices
   ```

2. **Connect Device**
   ```bash
   # Connect to device (replace DEVICE_ID)
   curl -X POST http://localhost:3000/api/devices/DEVICE_ID/connect
   ```

3. **Start BP Measurement**
   ```bash
   # Start blood pressure measurement
   curl -X POST http://localhost:3000/api/bp/DEVICE_ID/start-measurement
   ```

4. **Real-time Data (WebSocket)**
   ```javascript
   // Connect to WebSocket
   const socket = io('http://localhost:3000');
   
   // Listen for real-time data
   socket.on('bp_real_time_pressure', (data) => {
       console.log('Pressure:', data.pressure);
   });
   ```

## 📋 **Next Steps**

<function_calls>
<invoke name="todo_write">
<parameter name="merge">true