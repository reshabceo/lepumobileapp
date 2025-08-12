# 📱 Mobile App Integration Guide

## 🏗️ **Architecture Overview**

```
📱 Mobile App ↔ 🩺 Medical Device (Native Bluetooth)
     ↓
📱 Mobile App ↔ 🖥️ Backend API (HTTP/WebSocket)  
     ↓
🖥️ Backend API ↔ 🌐 Web Dashboard (Real-time data)
```

**Why This Architecture?**
- ✅ **No compilation issues** - No native modules in backend
- ✅ **Better mobile performance** - Native Bluetooth handling
- ✅ **More reliable** - Direct device-to-mobile communication
- ✅ **Works offline** - Mobile app can store data locally
- ✅ **Standard approach** - How Apple Health, Samsung Health work

## 📲 **Mobile App Implementation**

### **1. Android Integration (Kotlin)**

```kotlin
// 1. Add dependencies to app/build.gradle
dependencies {
    implementation 'no.nordicsemi.android:ble:2.6.1'
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'io.socket:socket.io-client:2.1.0'
}

// 2. API Service
class MedicalDeviceApiService {
    private val BASE_URL = "http://your-server:3000/api/"
    
    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
    
    private val api = retrofit.create(MedicalDeviceApi::class.java)
    
    suspend fun connectDevice(deviceId: String, deviceData: DeviceInfo) {
        api.connectDevice(deviceId, deviceData)
    }
    
    suspend fun sendBPMeasurement(deviceId: String, measurement: BPMeasurement) {
        api.sendBPMeasurement(deviceId, measurement)
    }
    
    suspend fun sendECGData(deviceId: String, ecgData: ECGData) {
        api.sendECGData(deviceId, ecgData)
    }
}

// 3. Device Data Models
data class DeviceInfo(
    val name: String,
    val model: String,
    val macAddress: String,
    val type: String, // "BP", "ECG", "OXIMETER", "GLUCOSE"
    val battery: Int? = null,
    val firmware: String? = null
)

data class BPMeasurement(
    val systolic: Int,
    val diastolic: Int,
    val mean: Int,
    val pulseRate: Int,
    val unit: String = "mmHg",
    val timestamp: String = System.currentTimeMillis().toString()
)

data class ECGData(
    val heartRate: Int,
    val waveformData: List<Int>,
    val samplingRate: Int = 125,
    val duration: Int,
    val leadOff: Boolean = false
)

// 4. Bluetooth Service Integration
class LepuDeviceService : Service() {
    private val apiService = MedicalDeviceApiService()
    
    // When device connects
    private fun onDeviceConnected(device: BluetoothDevice) {
        lifecycleScope.launch {
            val deviceInfo = DeviceInfo(
                name = device.name ?: "Unknown",
                model = detectDeviceModel(device),
                macAddress = device.address,
                type = detectDeviceType(device)
            )
            
            apiService.connectDevice(device.address, deviceInfo)
        }
    }
    
    // When BP measurement received
    private fun onBPMeasurementReceived(deviceId: String, data: BpResult) {
        lifecycleScope.launch {
            val measurement = BPMeasurement(
                systolic = data.systolic,
                diastolic = data.diastolic,
                mean = data.mean,
                pulseRate = data.pr
            )
            
            apiService.sendBPMeasurement(deviceId, measurement)
        }
    }
    
    // When ECG data received
    private fun onECGDataReceived(deviceId: String, data: EcgData) {
        lifecycleScope.launch {
            val ecgData = ECGData(
                heartRate = data.hr,
                waveformData = data.waveData,
                samplingRate = 125,
                duration = data.duration
            )
            
            apiService.sendECGData(deviceId, ecgData)
        }
    }
}
```

### **2. iOS Integration (Swift)**

```swift
// 1. Add to your Podfile
pod 'Socket.IO-Client-Swift'
pod 'Alamofire'

// 2. API Service
class MedicalDeviceAPIService {
    private let baseURL = "http://your-server:3000/api"
    
    func connectDevice(deviceId: String, deviceInfo: DeviceInfo) async throws {
        let url = "\(baseURL)/devices/\(deviceId)/connect"
        let response = try await AF.request(url, method: .post, 
                                          parameters: deviceInfo, 
                                          encoder: JSONParameterEncoder.default)
                                    .serializingDecodable(APIResponse.self)
                                    .value
    }
    
    func sendBPMeasurement(deviceId: String, measurement: BPMeasurement) async throws {
        let url = "\(baseURL)/bp/\(deviceId)/measurement"
        try await AF.request(url, method: .post, 
                           parameters: measurement, 
                           encoder: JSONParameterEncoder.default)
                    .serializingDecodable(APIResponse.self)
                    .value
    }
}

// 3. Device Models
struct DeviceInfo: Codable {
    let name: String
    let model: String
    let macAddress: String
    let type: String // "BP", "ECG", "OXIMETER", "GLUCOSE"
    let battery: Int?
    let firmware: String?
}

struct BPMeasurement: Codable {
    let systolic: Int
    let diastolic: Int
    let mean: Int
    let pulseRate: Int
    let unit: String = "mmHg"
    let timestamp: String = String(Date().timeIntervalSince1970 * 1000)
}

// 4. Core Bluetooth Integration
class LepuDeviceManager: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private let apiService = MedicalDeviceAPIService()
    
    // When device connects
    func peripheral(_ peripheral: CBPeripheral, didConnect: Void) {
        Task {
            let deviceInfo = DeviceInfo(
                name: peripheral.name ?? "Unknown",
                model: detectDeviceModel(peripheral),
                macAddress: peripheral.identifier.uuidString,
                type: detectDeviceType(peripheral)
            )
            
            try await apiService.connectDevice(deviceId: peripheral.identifier.uuidString, 
                                             deviceInfo: deviceInfo)
        }
    }
    
    // When BP measurement received
    func onBPMeasurementReceived(deviceId: String, measurement: BpResult) {
        Task {
            let bpMeasurement = BPMeasurement(
                systolic: measurement.systolic,
                diastolic: measurement.diastolic,
                mean: measurement.mean,
                pulseRate: measurement.pulseRate
            )
            
            try await apiService.sendBPMeasurement(deviceId: deviceId, measurement: bpMeasurement)
        }
    }
}
```

### **3. React Native Integration**

```javascript
// 1. Install dependencies
npm install react-native-ble-plx socket.io-client axios

// 2. API Service
class MedicalDeviceAPI {
    constructor(baseURL = 'http://your-server:3000/api') {
        this.baseURL = baseURL;
        this.socket = io('http://your-server:3000');
    }
    
    async connectDevice(deviceId, deviceInfo) {
        const response = await fetch(`${this.baseURL}/devices/${deviceId}/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deviceInfo)
        });
        return response.json();
    }
    
    async sendBPMeasurement(deviceId, measurement) {
        const response = await fetch(`${this.baseURL}/bp/${deviceId}/measurement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(measurement)
        });
        return response.json();
    }
    
    // Listen for real-time events
    onRealTimeData(callback) {
        this.socket.on('bp_measurement_complete', callback);
        this.socket.on('ecg_real_time_data', callback);
        this.socket.on('oxy_real_time_params', callback);
        this.socket.on('glucose_result', callback);
    }
}

// 3. Bluetooth Manager
import { BleManager } from 'react-native-ble-plx';

class LepuDeviceManager {
    constructor() {
        this.manager = new BleManager();
        this.api = new MedicalDeviceAPI();
    }
    
    async connectToDevice(device) {
        const connectedDevice = await device.connect();
        
        // Register device with backend
        await this.api.connectDevice(device.id, {
            name: device.name,
            model: this.detectModel(device),
            macAddress: device.id,
            type: this.detectType(device)
        });
        
        // Start monitoring characteristics
        this.monitorCharacteristics(connectedDevice);
    }
    
    async onBPMeasurement(deviceId, data) {
        await this.api.sendBPMeasurement(deviceId, {
            systolic: data.systolic,
            diastolic: data.diastolic,
            mean: data.mean,
            pulseRate: data.pulseRate
        });
    }
}
```

## 🔌 **Backend API Endpoints**

### **Device Management**
```http
POST /api/devices/:deviceId/connect
Content-Type: application/json

{
    "name": "BP2-12345",
    "model": "BP2",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "type": "BP",
    "battery": 85,
    "firmware": "1.0.3"
}
```

### **Blood Pressure**
```http
POST /api/bp/:deviceId/measurement
Content-Type: application/json

{
    "systolic": 120,
    "diastolic": 80,
    "mean": 93,
    "pulseRate": 72,
    "unit": "mmHg"
}
```

### **ECG Data**
```http
POST /api/ecg/:deviceId/data
Content-Type: application/json

{
    "heartRate": 75,
    "waveformData": [120, 121, 119, 122, ...],
    "samplingRate": 125,
    "duration": 30,
    "leadOff": false
}
```

### **Pulse Oximeter**
```http
POST /api/oximeter/:deviceId/measurement
Content-Type: application/json

{
    "spo2": 98,
    "pulseRate": 72,
    "pi": 2.1,
    "probeOff": false
}
```

### **Glucose Meter**
```http
POST /api/glucose/:deviceId/measurement
Content-Type: application/json

{
    "value": 110,
    "unit": "mg/dL",
    "result": "Normal",
    "testType": "fasting"
}
```

## 🔄 **Real-time WebSocket Events**

```javascript
// Connect to WebSocket
const socket = io('http://your-server:3000');

// Listen for real-time events
socket.on('device_discovered', (device) => {
    console.log('New device:', device);
});

socket.on('bp_measurement_complete', (data) => {
    console.log('BP Result:', data.systolic + '/' + data.diastolic);
});

socket.on('ecg_real_time_data', (data) => {
    console.log('ECG HR:', data.heartRate, 'Samples:', data.waveformData.length);
});

socket.on('oxy_real_time_params', (data) => {
    console.log('SpO2:', data.spo2 + '%', 'PR:', data.pulseRate);
});

socket.on('glucose_result', (data) => {
    console.log('Glucose:', data.value, data.unit);
});
```

## 📊 **Example Mobile Workflow**

1. **📱 Mobile App starts** → Scans for Lepu devices
2. **🔗 Device found** → Mobile connects via native Bluetooth
3. **📡 Register device** → `POST /api/devices/:id/connect`
4. **📊 Start measurement** → Device begins BP/ECG/SpO2 measurement
5. **📨 Receive data** → Mobile gets data via Bluetooth
6. **🚀 Send to backend** → `POST /api/bp/:id/measurement`
7. **🌐 Real-time broadcast** → Backend emits WebSocket event
8. **📺 Web dashboard** → Shows real-time data from mobile

## 🧪 **Testing Your Integration**

### **1. Test Device Registration**
```bash
curl -X POST http://localhost:3000/api/devices/test-bp-001/connect \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test BP Monitor",
    "model": "BP2",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "type": "BP",
    "battery": 85
  }'
```

### **2. Test Measurement**
```bash
curl -X POST http://localhost:3000/api/bp/test-bp-001/measurement \
  -H "Content-Type: application/json" \
  -d '{
    "systolic": 120,
    "diastolic": 80,
    "mean": 93,
    "pulseRate": 72
  }'
```

### **3. Check History**
```bash
curl http://localhost:3000/api/bp/test-bp-001/history
```

## 🚀 **Ready to Start!**

1. **Start backend**: `npm run dev`
2. **Test API**: Open test-client.html
3. **Integrate mobile**: Use code examples above
4. **Add real devices**: Connect your Lepu devices via mobile

This architecture gives you the **best of both worlds**:
- ✅ Reliable Bluetooth (handled natively by mobile)
- ✅ Real-time data sharing (via backend API)
- ✅ No compilation issues
- ✅ Works on any device/platform

**Start building your mobile medical app! 🏥📱**