# 🔗 Complete Integration Guide

## 📊 **Database Status**

### **Current: In-Memory Storage**
- ❌ **Location**: JavaScript Maps in `backend/src/app.js` 
- ❌ **Persistence**: Data lost on server restart
- ✅ **Works**: Perfect for testing and demo

### **Production: MongoDB Database**
- ✅ **Location**: `backend/src/app-with-database.js`
- ✅ **Persistence**: All data saved permanently
- ✅ **Scalable**: Production-ready

## 🔄 **Current Integration Status**

### **❌ Android App: NOT INTEGRATED**
- **Current**: Only displays data locally in UI
- **Missing**: Doesn't send data to backend API
- **Files**: All `*Activity.kt` files just show data

### **✅ Backend API: READY**
- **Status**: Running and waiting for mobile data
- **Endpoints**: All API routes working
- **WebSocket**: Real-time events ready

## 🚀 **How to Integrate Everything**

### **Step 1: Choose Your Database**

#### **Option A: Quick Testing (In-Memory)**
```bash
cd backend
npm install
node src/app.js
```
**✅ Use this for**: Testing, development, demo  
**❌ Don't use for**: Production (data is lost on restart)

#### **Option B: Production (MongoDB)**
```bash
cd backend
npm install

# Install MongoDB locally OR use MongoDB Atlas (cloud)
# For local MongoDB:
# 1. Download MongoDB from https://www.mongodb.com/try/download/community
# 2. Install and start MongoDB service

# Start with database
node src/app-with-database.js
```
**✅ Use this for**: Production, persistent storage  
**✅ Features**: Data survives restarts, scalable, production-ready

### **Step 2: Modify Android App**

#### **2.1 Add Dependencies to `app/build.gradle`**
```kotlin
dependencies {
    // ... existing dependencies ...
    
    // API integration
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
}
```

#### **2.2 Add Network Permissions to `AndroidManifest.xml`**
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<application
    android:usesCleartextTraffic="true"
    ... >
```

#### **2.3 Add API Service**
Create `app/src/main/java/com/example/lpdemo/api/ApiService.kt`  
👉 **Copy code from**: `backend/android-integration/ApiService.kt`

#### **2.4 Modify Activities**
**For Blood Pressure devices**, modify your `BpmActivity.kt`:  
👉 **Copy code from**: `backend/android-integration/BpmActivity_Modified.kt`

**For ECG devices**, modify your `Pc80bActivity.kt`:  
👉 **Copy code from**: `backend/android-integration/Pc80bActivity_Modified.kt`

**For other devices**, follow the same pattern:
1. Add `MedicalDeviceApiService` instance
2. Register device on activity start with `registerDeviceWithBackend()`
3. In measurement event observers, add API calls like `sendXXXToBackend()`

### **Step 3: Update Base URL**

In `ApiService.kt`, change the base URL:

```kotlin
// For Android Emulator
private const val BASE_URL = "http://10.0.2.2:3000/api/"

// For Real Android Device (replace with your computer's IP)
private const val BASE_URL = "http://192.168.1.100:3000/api/"
```

**Find your computer's IP:**
- Windows: `ipconfig`
- Mac/Linux: `ifconfig`

### **Step 4: Test Integration**

#### **4.1 Start Backend**
```bash
cd backend
npm run dev
# Server running on http://localhost:3000
```

#### **4.2 Test API**
```bash
curl http://localhost:3000/api/health
```

#### **4.3 Run Android App**
1. Build and run your modified Android app
2. Connect to a Lepu device via Bluetooth
3. Take a measurement (BP, ECG, etc.)
4. Check backend logs - you should see:
```
📱 Device registered: BP2-12345 (BP)
📊 Measurement stored: blood_pressure for aa:bb:cc:dd:ee:ff
```

#### **4.4 View Data**
Open `backend/test-client.html` in browser to see real-time data from your mobile app!

## 🏗️ **Architecture Flow**

```
📱 Android App ↔ 🩺 Lepu Device (Bluetooth)
     ↓ HTTP API
🖥️ Backend API ↔ 📊 Database (MongoDB)
     ↓ WebSocket
🌐 Web Dashboard (Real-time updates)
```

**Data Flow:**
1. **📱 Mobile App** connects to **🩺 Lepu Device** via Bluetooth
2. **📱 Mobile App** receives measurement data from device
3. **📱 Mobile App** sends data to **🖥️ Backend API** via HTTP
4. **🖥️ Backend API** stores data in **📊 Database**
5. **🖥️ Backend API** broadcasts real-time events via **WebSocket**
6. **🌐 Web Dashboard** receives real-time updates

## 📱 **Device Integration Examples**

### **Blood Pressure (BP2, BP3, AirBP)**
```kotlin
// In BpmActivity.kt
LiveEventBus.get<InterfaceEvent>(InterfaceEvent.BPM.EventBpmMeasureResult)
    .observe(this) {
        val data = it.data as RecordData
        
        // Original: Update UI only
        binding.tvSys.text = "${data.sys}"
        binding.tvDia.text = "${data.dia}"
        
        // NEW: Send to backend
        lifecycleScope.launch {
            apiService.sendBPMeasurement(deviceId, BPMeasurement(
                systolic = data.sys,
                diastolic = data.dia,
                mean = (data.sys + 2 * data.dia) / 3,
                pulseRate = data.pr
            ))
        }
    }
```

### **ECG (ER1, ER2, ER3, PC-80B)**
```kotlin
// In EcgActivity.kt  
LiveEventBus.get<InterfaceEvent>(InterfaceEvent.PC80B.EventPc80bContinuousData)
    .observe(this) {
        val data = it.data as RtContinuousData
        
        // Original: Update UI only
        binding.hr.text = "${data.hr}"
        
        // NEW: Collect waveform and send to backend
        ecgWaveBuffer.addAll(data.ecgData.ecgFloats)
        
        // When recording stops, send complete ECG
        if (recordingComplete) {
            lifecycleScope.launch {
                apiService.sendECGData(deviceId, ECGData(
                    heartRate = data.hr,
                    waveformData = ecgWaveBuffer.toList(),
                    samplingRate = 150,
                    duration = recordingDuration
                ))
            }
        }
    }
```

### **Pulse Oximeter (PC-60FW, O2Ring)**
```kotlin
// In OximeterActivity.kt
LiveEventBus.get<InterfaceEvent>(InterfaceEvent.PC60FW.EventPc60fwRtParam)
    .observe(this) {
        val data = it.data as RtParam
        
        // Original: Update UI only
        binding.tvSpo2.text = "${data.spo2}"
        binding.tvPr.text = "${data.pr}"
        
        // NEW: Send to backend
        lifecycleScope.launch {
            apiService.sendOximeterData(deviceId, OximeterData(
                spo2 = data.spo2,
                pulseRate = data.pr,
                pi = data.pi,
                probeOff = data.probeOff
            ))
        }
    }
```

### **Glucose Meter (Bioland-BGM)**
```kotlin
// In GlucoseActivity.kt
LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bioland.EventBiolandBgmGluData)
    .observe(this) {
        val data = it.data as GluData
        
        // Original: Update UI only
        binding.tvGlucose.text = "${data.value}"
        
        // NEW: Send to backend
        lifecycleScope.launch {
            apiService.sendGlucoseData(deviceId, GlucoseData(
                value = data.value,
                unit = "mg/dL",
                result = determineGlucoseResult(data.value),
                testType = "random"
            ))
        }
    }
```

## ✅ **Integration Checklist**

### **Backend Setup**
- [ ] ✅ Dependencies installed (`npm install`)
- [ ] ✅ Database choice made (in-memory vs MongoDB)
- [ ] ✅ Server running (`npm run dev`)
- [ ] ✅ Health check working (`curl http://localhost:3000/api/health`)

### **Android Integration**
- [ ] 📱 Dependencies added to `build.gradle`
- [ ] 📱 Network permissions added to `AndroidManifest.xml`
- [ ] 📱 `ApiService.kt` created
- [ ] 📱 Activities modified to call API
- [ ] 📱 Base URL updated for your network
- [ ] 📱 App builds and runs successfully

### **Testing**
- [ ] 🧪 Device registration works (check backend logs)
- [ ] 🧪 Measurements sent to backend (check API logs)
- [ ] 🧪 Data appears in web dashboard (`test-client.html`)
- [ ] 🧪 Real-time events working (WebSocket)

## 🎯 **Result**

After integration, you'll have:

✅ **📱 Mobile App**: Handles Bluetooth + sends data to cloud  
✅ **🖥️ Backend API**: Receives and stores all device data  
✅ **📊 Database**: Persistent storage of all measurements  
✅ **🌐 Web Dashboard**: Real-time monitoring and history  
✅ **🔄 Real-time Events**: Live updates across all clients  

**Perfect for:**
- 🏥 Hospital monitoring systems
- 👨‍⚕️ Doctor dashboards  
- 📊 Health analytics platforms
- 👥 Family health sharing
- 📱 Multi-device synchronization

## 🆘 **Troubleshooting**

### **Android App Can't Reach Backend**
1. Check network permissions in `AndroidManifest.xml`
2. Verify base URL (use `10.0.2.2` for emulator, actual IP for device)
3. Ensure `android:usesCleartextTraffic="true"` if using HTTP
4. Check firewall settings on computer running backend

### **Database Connection Issues**
1. For MongoDB: Ensure MongoDB is running (`mongod`)
2. Check connection string in `.env` file
3. Verify MongoDB service is started

### **No Real-time Updates**
1. Check WebSocket connection in browser dev tools
2. Verify CORS settings in backend
3. Ensure proper event emission in device activities

**You now have a complete, production-ready medical device platform! 🚀🏥**