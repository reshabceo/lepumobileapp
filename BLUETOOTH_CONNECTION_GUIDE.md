# 🔗 Bluetooth Device Connection Guide

## 🎯 **Quick Start - Connect Your Device Right Now**

Your application is running at:
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3000

## 📱 **Step-by-Step Connection Process**

### **1. Access the Device Management Interface**

1. Open your browser and go to **http://localhost:8080**
2. Navigate to **Devices** → **LepuDemo Devices**
3. Click **"Add Device"** to register a new medical device

### **2. Register Your Device**

In the "Add LepuDemo Device" modal:

1. **Select Device Model** from the dropdown:
   - **BP2/BP3** - Blood Pressure Monitors
   - **ER1/ER2/ER3** - ECG Devices  
   - **PC-80B/PC-300** - ECG Devices
   - **PC-60FW/O2Ring** - Pulse Oximeters
   - **Bioland-BGM/LPM311** - Blood Glucose Meters

2. **Enter MAC Address** (format: AA:BB:CC:DD:EE:FF)
   - Find this on your device or in device settings
   - Example: `AA:BB:CC:DD:EE:FF`

3. **Device Name** (optional)
   - Give your device a friendly name
   - Example: "My BP Monitor"

4. Click **"Add Device"**

### **3. Connect via Mobile App**

#### **Option A: Android App (Recommended)**

1. **Download the Android Integration Code**:
   ```bash
   # The Android integration is in the backend folder
   cd backend/android-integration/
   ```

2. **Key Files Available**:
   - `BpmActivity_Modified.kt` - Blood Pressure Monitor integration
   - `Pc80bActivity_Modified.kt` - ECG Device integration
   - `ApiService.kt` - Backend API communication
   - `build.gradle.modifications` - Required dependencies

3. **Integration Steps**:
   ```kotlin
   // 1. Add to your Android app's build.gradle
   dependencies {
       implementation 'no.nordicsemi.android:ble:2.6.1'
       implementation 'com.squareup.retrofit2:retrofit:2.9.0'
       implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
       implementation 'io.socket:socket.io-client:2.1.0'
   }
   
   // 2. Use the provided ApiService.kt for backend communication
   // 3. Use BpmActivity_Modified.kt for BP device integration
   // 4. Use Pc80bActivity_Modified.kt for ECG device integration
   ```

#### **Option B: iOS App**

1. **Use the iOS integration code** from `backend/MOBILE_INTEGRATION.md`
2. **Add to your Podfile**:
   ```ruby
   pod 'Socket.IO-Client-Swift'
   pod 'Alamofire'
   ```

#### **Option C: React Native App**

1. **Install dependencies**:
   ```bash
   npm install react-native-ble-plx socket.io-client axios
   ```

2. **Use the React Native integration** from `backend/MOBILE_INTEGRATION.md`

### **4. Test the Connection**

#### **Using the Web Interface**

1. **Simulate Device Connection**:
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

2. **Send Test Measurement**:
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

3. **Check Device Status**:
   ```bash
   curl http://localhost:3000/api/devices/test-bp-001/status
   ```

#### **Using the Test Client**

1. Open `backend/test-client.html` in your browser
2. This provides a complete testing interface for:
   - Device discovery and connection
   - Real-time measurement simulation
   - WebSocket event monitoring

## 🔧 **Device-Specific Connection Details**

### **Blood Pressure Monitors (BP2, BP3, AirBP, BPM-188)**

```kotlin
// Android Integration
class BpmActivity : AppCompatActivity() {
    private val apiService = MedicalDeviceApiService()
    
    // When device connects via Bluetooth
    private fun onDeviceConnected(device: BluetoothDevice) {
        lifecycleScope.launch {
            val deviceInfo = DeviceInfo(
                name = device.name ?: "BP Monitor",
                model = "BP2",
                macAddress = device.address,
                type = "BP"
            )
            
            // Register with backend
            apiService.connectDevice(device.address, deviceInfo)
        }
    }
    
    // When BP measurement received
    private fun onBPMeasurementReceived(data: BpResult) {
        lifecycleScope.launch {
            val measurement = BPMeasurement(
                systolic = data.systolic,
                diastolic = data.diastolic,
                mean = data.mean,
                pulseRate = data.pr
            )
            
            // Send to backend
            apiService.sendBPMeasurement(deviceAddress, measurement)
        }
    }
}
```

### **ECG Devices (ER1, ER2, ER3, PC-80B, PC-300)**

```kotlin
// Android Integration
class EcgActivity : AppCompatActivity() {
    private val apiService = MedicalDeviceApiService()
    
    // When ECG data received
    private fun onECGDataReceived(data: EcgData) {
        lifecycleScope.launch {
            val ecgData = ECGData(
                heartRate = data.hr,
                waveformData = data.waveData,
                samplingRate = 125,
                duration = data.duration
            )
            
            // Send to backend
            apiService.sendECGData(deviceAddress, ecgData)
        }
    }
}
```

### **Pulse Oximeters (PC-60FW, O2Ring, SP20, PF-10AW)**

```kotlin
// Android Integration
class OximeterActivity : AppCompatActivity() {
    private val apiService = MedicalDeviceApiService()
    
    // When oximeter data received
    private fun onOximeterDataReceived(data: OximeterData) {
        lifecycleScope.launch {
            val oximeterData = OximeterData(
                spo2 = data.spo2,
                pulseRate = data.pr,
                pi = data.pi,
                probeOff = data.probeOff
            )
            
            // Send to backend
            apiService.sendOximeterData(deviceAddress, oximeterData)
        }
    }
}
```

### **Blood Glucose Meters (Bioland-BGM, LPM311)**

```kotlin
// Android Integration
class GlucoseActivity : AppCompatActivity() {
    private val apiService = MedicalDeviceApiService()
    
    // When glucose measurement received
    private fun onGlucoseMeasurementReceived(data: GlucoseData) {
        lifecycleScope.launch {
            val glucoseData = GlucoseMeasurement(
                value = data.value,
                unit = "mg/dL",
                result = data.result,
                testType = data.testType
            )
            
            // Send to backend
            apiService.sendGlucoseMeasurement(deviceAddress, glucoseData)
        }
    }
}
```

## 🌐 **Real-time Data Flow**

```
📱 Mobile App (Bluetooth) → 🖥️ Backend API → 🌐 Web Dashboard
```

1. **Mobile app connects to device** via native Bluetooth
2. **Device sends data** to mobile app
3. **Mobile app forwards data** to backend API
4. **Backend broadcasts** to all connected web clients
5. **Web dashboard updates** in real-time

## 🔍 **Troubleshooting**

### **Device Not Found**
- ✅ Check Bluetooth is enabled
- ✅ Ensure device is in pairing mode
- ✅ Verify device is within range
- ✅ Check device battery level

### **Connection Failed**
- ✅ Verify MAC address format (AA:BB:CC:DD:EE:FF)
- ✅ Check device is not connected to another app
- ✅ Restart Bluetooth on mobile device
- ✅ Try re-pairing the device

### **Data Not Syncing**
- ✅ Check internet connection
- ✅ Verify backend server is running (port 3000)
- ✅ Check API endpoint URLs
- ✅ Review browser console for errors

### **Web Dashboard Not Updating**
- ✅ Check WebSocket connection
- ✅ Verify real-time events are being sent
- ✅ Refresh the web page
- ✅ Check browser console for errors

## 📊 **Monitoring Your Connection**

### **Check Device Status**
```bash
# Get all devices
curl http://localhost:3000/api/devices

# Get specific device
curl http://localhost:3000/api/devices/your-device-id

# Get device status
curl http://localhost:3000/api/devices/your-device-id/status
```

### **View Measurement History**
```bash
# Blood Pressure history
curl http://localhost:3000/api/bp/your-device-id/history

# ECG recordings
curl http://localhost:3000/api/ecg/your-device-id/history

# Oximeter measurements
curl http://localhost:3000/api/oximeter/your-device-id/history

# Glucose measurements
curl http://localhost:3000/api/glucose/your-device-id/history
```

### **Real-time WebSocket Events**
```javascript
// Connect to WebSocket
const socket = io('http://localhost:3000');

// Listen for events
socket.on('device_discovered', (device) => {
    console.log('New device:', device);
});

socket.on('bp_measurement_complete', (data) => {
    console.log('BP Result:', data.systolic + '/' + data.diastolic);
});

socket.on('ecg_real_time_data', (data) => {
    console.log('ECG HR:', data.heartRate);
});

socket.on('oxy_real_time_params', (data) => {
    console.log('SpO2:', data.spo2 + '%');
});
```

## 🚀 **Next Steps**

1. **✅ Your backend is running** - Ready to receive device data
2. **✅ Web interface is ready** - Can display real-time data
3. **📱 Integrate mobile app** - Use the provided Android/iOS code
4. **🔗 Connect real devices** - Follow the device-specific guides
5. **📊 Monitor data** - Use the web dashboard for real-time monitoring

## 🆘 **Need Help?**

- **Backend Issues**: Check `backend/README.md`
- **Mobile Integration**: See `backend/MOBILE_INTEGRATION.md`
- **Android Setup**: Review `backend/android-integration/`
- **API Documentation**: Check `backend/docs/backend-api-structure.md`
- **Test Client**: Use `backend/test-client.html`

---

**🎉 You're ready to connect your medical devices! Start with the web interface at http://localhost:8080 and then integrate your mobile app for real Bluetooth connectivity.** 