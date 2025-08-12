# Medical Device API - Testing Guide

## 🚀 Quick Start Testing

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Environment

```bash
# Copy environment file
cp env.example .env

# Edit .env file with your settings
# PORT=3000
# NODE_ENV=development
```

### 3. Start the API Server

```bash
# Development mode (auto-reload)
npm run dev

# Or production mode
npm start
```

The server will start on `http://localhost:3000`

## 📋 **API Testing Methods**

### Method 1: Using curl (Command Line)

#### Health Check
```bash
curl http://localhost:3000/api/health
```

#### Device Discovery
```bash
# Start scanning for devices
curl -X POST http://localhost:3000/api/devices/scan/start

# Get discovered devices
curl http://localhost:3000/api/devices
```

#### Connect to Device
```bash
# Replace DEVICE_ID with actual device ID from discovery
curl -X POST http://localhost:3000/api/devices/DEVICE_ID/connect
```

#### Blood Pressure Test
```bash
# Start BP measurement
curl -X POST http://localhost:3000/api/bp/DEVICE_ID/start-measurement

# Get real-time data
curl http://localhost:3000/api/bp/DEVICE_ID/real-time

# Get measurement history
curl http://localhost:3000/api/bp/DEVICE_ID/history
```

#### ECG Test
```bash
# Start ECG recording
curl -X POST http://localhost:3000/api/ecg/DEVICE_ID/start-recording \
  -H "Content-Type: application/json" \
  -d '{"duration": 30}'

# Get real-time ECG data
curl http://localhost:3000/api/ecg/DEVICE_ID/real-time

# Get ECG files
curl http://localhost:3000/api/ecg/DEVICE_ID/files
```

#### Pulse Oximeter Test
```bash
# Get real-time SpO2 data
curl http://localhost:3000/api/oximeter/DEVICE_ID/real-time

# Get pulse waveform
curl http://localhost:3000/api/oximeter/DEVICE_ID/waveform

# Start continuous monitoring
curl -X POST http://localhost:3000/api/oximeter/DEVICE_ID/start-monitoring
```

#### Glucose Meter Test
```bash
# Start glucose measurement
curl -X POST http://localhost:3000/api/glucose/DEVICE_ID/measure

# Get latest reading
curl http://localhost:3000/api/glucose/DEVICE_ID/latest

# Get measurement history
curl http://localhost:3000/api/glucose/DEVICE_ID/history
```

### Method 2: Using Postman

Import the following collection:

```json
{
  "info": {
    "name": "Medical Device API",
    "description": "API for Lepu Medical Devices"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/health",
          "host": ["{{baseUrl}}"],
          "path": ["api", "health"]
        }
      }
    },
    {
      "name": "Get Devices",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/devices",
          "host": ["{{baseUrl}}"],
          "path": ["api", "devices"]
        }
      }
    },
    {
      "name": "Start BP Measurement",
      "request": {
        "method": "POST",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/bp/{{deviceId}}/start-measurement",
          "host": ["{{baseUrl}}"],
          "path": ["api", "bp", "{{deviceId}}", "start-measurement"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "deviceId",
      "value": "your-device-id"
    }
  ]
}
```

### Method 3: Web Client Testing

Create `test-client.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Medical Device API Test Client</title>
    <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ccc; }
        button { margin: 5px; padding: 10px; }
        .data { background: #f5f5f5; padding: 10px; margin: 10px 0; }
        .real-time { background: #e8f5e8; }
        .error { background: #ffe8e8; }
    </style>
</head>
<body>
    <h1>Medical Device API Test Client</h1>
    
    <div class="section">
        <h2>Connection Status</h2>
        <div id="connection-status">Disconnected</div>
        <button onclick="checkHealth()">Check API Health</button>
    </div>

    <div class="section">
        <h2>Device Discovery</h2>
        <button onclick="startScan()">Start Scan</button>
        <button onclick="stopScan()">Stop Scan</button>
        <button onclick="getDevices()">Get Devices</button>
        <div id="devices-list"></div>
    </div>

    <div class="section">
        <h2>Device Control</h2>
        <input type="text" id="device-id" placeholder="Device ID">
        <button onclick="connectDevice()">Connect</button>
        <button onclick="disconnectDevice()">Disconnect</button>
        <div id="device-status"></div>
    </div>

    <div class="section">
        <h2>Blood Pressure</h2>
        <button onclick="startBP()">Start Measurement</button>
        <button onclick="stopBP()">Stop Measurement</button>
        <button onclick="getBPRealTime()">Get Real-time Data</button>
        <div id="bp-data" class="data"></div>
    </div>

    <div class="section">
        <h2>ECG</h2>
        <button onclick="startECG()">Start Recording</button>
        <button onclick="stopECG()">Stop Recording</button>
        <button onclick="getECGRealTime()">Get Real-time ECG</button>
        <button onclick="getECGFiles()">Get ECG Files</button>
        <div id="ecg-data" class="data"></div>
    </div>

    <div class="section">
        <h2>Pulse Oximeter</h2>
        <button onclick="getOxyRealTime()">Get Real-time Data</button>
        <button onclick="getWaveform()">Get Waveform</button>
        <button onclick="startOxyMonitoring()">Start Monitoring</button>
        <div id="oxy-data" class="data"></div>
    </div>

    <div class="section">
        <h2>Glucose Meter</h2>
        <button onclick="startGlucose()">Start Measurement</button>
        <button onclick="getLatestGlucose()">Get Latest Reading</button>
        <button onclick="getGlucoseHistory()">Get History</button>
        <div id="glucose-data" class="data"></div>
    </div>

    <div class="section">
        <h2>Real-time Events</h2>
        <div id="real-time-events" class="data real-time"></div>
    </div>

    <script>
        const API_BASE = 'http://localhost:3000/api';
        let currentDeviceId = '';
        let socket;

        // Initialize WebSocket connection
        function initWebSocket() {
            socket = io('http://localhost:3000');
            
            socket.on('connect', () => {
                document.getElementById('connection-status').innerHTML = 
                    '<span style="color: green;">Connected to WebSocket</span>';
            });

            socket.on('disconnect', () => {
                document.getElementById('connection-status').innerHTML = 
                    '<span style="color: red;">Disconnected from WebSocket</span>';
            });

            // Device events
            socket.on('device_discovered', (device) => {
                addRealTimeEvent('Device Discovered', device);
            });

            socket.on('device_connected', (data) => {
                addRealTimeEvent('Device Connected', data);
            });

            // BP events
            socket.on('bp_real_time_pressure', (data) => {
                addRealTimeEvent('BP Real-time Pressure', data);
                document.getElementById('bp-data').innerHTML = 
                    `<strong>Pressure:</strong> ${data.pressure} mmHg<br>
                     <strong>Pulse:</strong> ${data.pulseRate} bpm`;
            });

            socket.on('bp_measurement_complete', (data) => {
                addRealTimeEvent('BP Measurement Complete', data);
                document.getElementById('bp-data').innerHTML = 
                    `<strong>Systolic:</strong> ${data.systolic} mmHg<br>
                     <strong>Diastolic:</strong> ${data.diastolic} mmHg<br>
                     <strong>Mean:</strong> ${data.mean} mmHg<br>
                     <strong>Pulse:</strong> ${data.pulseRate} bpm`;
            });

            // ECG events
            socket.on('ecg_real_time_data', (data) => {
                addRealTimeEvent('ECG Real-time Data', data);
                document.getElementById('ecg-data').innerHTML = 
                    `<strong>Heart Rate:</strong> ${data.heartRate} bpm<br>
                     <strong>Lead Off:</strong> ${data.leadOff ? 'Yes' : 'No'}<br>
                     <strong>Samples:</strong> ${data.waveformData ? data.waveformData.length : 0}`;
            });

            // Oximeter events
            socket.on('oxy_real_time_params', (data) => {
                addRealTimeEvent('Oximeter Real-time Data', data);
                document.getElementById('oxy-data').innerHTML = 
                    `<strong>SpO2:</strong> ${data.spo2}%<br>
                     <strong>Pulse Rate:</strong> ${data.pulseRate} bpm<br>
                     <strong>PI:</strong> ${data.pi}%<br>
                     <strong>Probe Off:</strong> ${data.probeOff ? 'Yes' : 'No'}`;
            });

            // Glucose events
            socket.on('glucose_result', (data) => {
                addRealTimeEvent('Glucose Result', data);
                document.getElementById('glucose-data').innerHTML = 
                    `<strong>Value:</strong> ${data.value} ${data.unit}<br>
                     <strong>Result:</strong> ${data.result}`;
            });
        }

        function addRealTimeEvent(type, data) {
            const eventsDiv = document.getElementById('real-time-events');
            const timestamp = new Date().toLocaleTimeString();
            eventsDiv.innerHTML = 
                `<div><strong>[${timestamp}] ${type}:</strong> ${JSON.stringify(data)}</div>` + 
                eventsDiv.innerHTML;
        }

        // API functions
        async function apiCall(endpoint, method = 'GET', body = null) {
            try {
                const options = {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                
                if (body) {
                    options.body = JSON.stringify(body);
                }

                const response = await fetch(API_BASE + endpoint, options);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'API Error');
                }
                
                return data;
            } catch (error) {
                console.error('API Error:', error);
                alert('Error: ' + error.message);
                throw error;
            }
        }

        function getCurrentDeviceId() {
            const deviceId = document.getElementById('device-id').value || currentDeviceId;
            if (!deviceId) {
                alert('Please enter a device ID');
                return null;
            }
            return deviceId;
        }

        // Health check
        async function checkHealth() {
            try {
                const data = await apiCall('/health');
                alert('API Health: ' + JSON.stringify(data, null, 2));
            } catch (error) {
                alert('Health check failed: ' + error.message);
            }
        }

        // Device management
        async function startScan() {
            await apiCall('/devices/scan/start', 'POST');
            alert('Device scanning started');
        }

        async function stopScan() {
            await apiCall('/devices/scan/stop', 'POST');
            alert('Device scanning stopped');
        }

        async function getDevices() {
            const data = await apiCall('/devices');
            const devicesList = document.getElementById('devices-list');
            devicesList.innerHTML = '<h3>Discovered Devices:</h3>';
            
            data.devices.forEach(device => {
                devicesList.innerHTML += 
                    `<div>
                        <strong>${device.name}</strong> (${device.model}) - ${device.id}
                        <button onclick="selectDevice('${device.id}')">Select</button>
                        ${device.connected ? '<span style="color: green;">Connected</span>' : ''}
                    </div>`;
            });
        }

        function selectDevice(deviceId) {
            currentDeviceId = deviceId;
            document.getElementById('device-id').value = deviceId;
            alert('Selected device: ' + deviceId);
        }

        async function connectDevice() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            await apiCall(`/devices/${deviceId}/connect`, 'POST');
            alert('Device connected');
        }

        async function disconnectDevice() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            await apiCall(`/devices/${deviceId}/connect`, 'DELETE');
            alert('Device disconnected');
        }

        // Blood pressure functions
        async function startBP() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            await apiCall(`/bp/${deviceId}/start-measurement`, 'POST');
            alert('BP measurement started');
        }

        async function stopBP() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            await apiCall(`/bp/${deviceId}/stop-measurement`, 'POST');
            alert('BP measurement stopped');
        }

        async function getBPRealTime() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            const data = await apiCall(`/bp/${deviceId}/real-time`);
            document.getElementById('bp-data').innerHTML = JSON.stringify(data, null, 2);
        }

        // ECG functions
        async function startECG() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            await apiCall(`/ecg/${deviceId}/start-recording`, 'POST', { duration: 30 });
            alert('ECG recording started');
        }

        async function stopECG() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            await apiCall(`/ecg/${deviceId}/stop-recording`, 'POST');
            alert('ECG recording stopped');
        }

        async function getECGRealTime() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            const data = await apiCall(`/ecg/${deviceId}/real-time`);
            document.getElementById('ecg-data').innerHTML = JSON.stringify(data, null, 2);
        }

        async function getECGFiles() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            const data = await apiCall(`/ecg/${deviceId}/files`);
            document.getElementById('ecg-data').innerHTML = JSON.stringify(data, null, 2);
        }

        // Oximeter functions
        async function getOxyRealTime() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            const data = await apiCall(`/oximeter/${deviceId}/real-time`);
            document.getElementById('oxy-data').innerHTML = JSON.stringify(data, null, 2);
        }

        async function getWaveform() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            const data = await apiCall(`/oximeter/${deviceId}/waveform`);
            document.getElementById('oxy-data').innerHTML = JSON.stringify(data, null, 2);
        }

        async function startOxyMonitoring() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            await apiCall(`/oximeter/${deviceId}/start-monitoring`, 'POST');
            alert('Oximeter monitoring started');
        }

        // Glucose functions
        async function startGlucose() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            await apiCall(`/glucose/${deviceId}/measure`, 'POST');
            alert('Glucose measurement started');
        }

        async function getLatestGlucose() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            const data = await apiCall(`/glucose/${deviceId}/latest`);
            document.getElementById('glucose-data').innerHTML = JSON.stringify(data, null, 2);
        }

        async function getGlucoseHistory() {
            const deviceId = getCurrentDeviceId();
            if (!deviceId) return;
            
            const data = await apiCall(`/glucose/${deviceId}/history`);
            document.getElementById('glucose-data').innerHTML = JSON.stringify(data, null, 2);
        }

        // Initialize WebSocket when page loads
        window.onload = function() {
            initWebSocket();
        };
    </script>
</body>
</html>
```

### Method 4: Automated Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🔍 **Testing Workflow**

### 1. **Start API Server**
```bash
npm run dev
```

### 2. **Test Health Check**
```bash
curl http://localhost:3000/api/health
```

### 3. **Test Device Discovery**
```bash
curl -X POST http://localhost:3000/api/devices/scan/start
curl http://localhost:3000/api/devices
```

### 4. **Connect to Device** (Replace with actual device ID)
```bash
curl -X POST http://localhost:3000/api/devices/YOUR_DEVICE_ID/connect
```

### 5. **Test Device Functions**
```bash
# Blood Pressure
curl -X POST http://localhost:3000/api/bp/YOUR_DEVICE_ID/start-measurement

# ECG
curl -X POST http://localhost:3000/api/ecg/YOUR_DEVICE_ID/start-recording

# Pulse Oximeter
curl http://localhost:3000/api/oximeter/YOUR_DEVICE_ID/real-time

# Glucose
curl -X POST http://localhost:3000/api/glucose/YOUR_DEVICE_ID/measure
```

### 6. **Test WebSocket (Open test-client.html in browser)**
- Open `test-client.html` in your web browser
- Use the interactive interface to test all functions
- Watch real-time events in the bottom panel

## 📊 **Expected Responses**

### Health Check Response
```json
{
  "status": "ok",
  "timestamp": "2025-01-30T22:17:00.000Z",
  "uptime": 123.456,
  "memory": {...},
  "devices": {
    "discovered": 2,
    "connected": 1
  },
  "bluetooth": {
    "state": "poweredOn",
    "scanning": true
  }
}
```

### Device Discovery Response
```json
{
  "success": true,
  "count": 2,
  "devices": [
    {
      "id": "aa:bb:cc:dd:ee:ff",
      "name": "BP2-12345",
      "model": "BP2",
      "macAddress": "aa:bb:cc:dd:ee:ff",
      "connected": false,
      "rssi": -45
    }
  ]
}
```

### Real-time WebSocket Events
```javascript
// Device discovered
{ "id": "device-123", "name": "BP2-12345", "model": "BP2" }

// BP real-time data
{ "deviceId": "device-123", "pressure": 120, "pulseRate": 75 }

// ECG real-time data
{ "deviceId": "device-123", "heartRate": 75, "waveformData": [...] }

// Oximeter real-time data
{ "deviceId": "device-123", "spo2": 98, "pulseRate": 75, "pi": 2.1 }
```

## 🚨 **Troubleshooting**

### Common Issues:

1. **Bluetooth Permission Issues**
   - Ensure Bluetooth is enabled
   - Run with administrator privileges if needed
   - Check device permissions

2. **Device Not Found**
   - Ensure device is in pairing mode
   - Check device is within range
   - Verify device model is supported

3. **Connection Failed**
   - Device may already be connected to another app
   - Try restarting the device
   - Check Bluetooth stack

4. **API Errors**
   - Check server logs: `npm run dev`
   - Verify device is connected before testing functions
   - Ensure correct device ID format

Now you have a complete, testable backend API! 🎉