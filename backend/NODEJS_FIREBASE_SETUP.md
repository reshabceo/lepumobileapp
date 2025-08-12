# 🔥 Node.js Backend + Firebase Database Setup

## 🎯 **Architecture**
```
📱 Android App → 🖥️ Node.js Backend → 🔥 Firebase Database
```

Your existing Node.js API server now saves data to Firebase instead of memory!

## 🚀 **Quick Setup (15 minutes)**

### **Step 1: Install Firebase Admin SDK**

```bash
cd backend
npm install firebase-admin
```

### **Step 2: Create Firebase Project**

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Create a project**: `lepu-medical-api`
3. **Enable Firestore Database**:
   - Go to "Firestore Database" 
   - Click "Create database"
   - Choose "Start in production mode"
   - Select your region

### **Step 3: Get Firebase Credentials**

#### **Option A: Service Account Key (Recommended for Development)**

1. **Go to Project Settings** → Service accounts
2. **Click "Generate new private key"**
3. **Download the JSON file**
4. **Rename to**: `firebase-service-account.json`
5. **Place in**: `backend/src/firebase-service-account.json`

#### **Option B: Application Default Credentials (Recommended for Production)**

```bash
# Install Google Cloud CLI
# Then run:
gcloud auth application-default login
```

### **Step 4: Update Your Backend**

Replace your current `backend/src/app.js` with the Firebase version:

```bash
cd backend/src
cp app.js app-original.js          # Backup original
cp app-firebase.js app.js          # Use Firebase version
```

**Or** modify the import in `app-firebase.js`:

```javascript
// Option 1: Use service account key file
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
```

### **Step 5: Test the Setup**

```bash
cd backend
npm install                        # Install firebase-admin
node src/app-firebase.js          # Start with Firebase
```

You should see:
```
🔥 Firebase Admin initialized successfully
📊 Using Firebase storage
🏥 Medical Device API Server Started!
🔥 Database: Firebase Firestore
```

## 📊 **Firebase Database Structure**

Your app will automatically create these collections:

```
🔥 Firestore Collections:

/devices/
  └── {deviceId}/
      ├── id: "device123"
      ├── name: "Blood Pressure Monitor" 
      ├── model: "BP2"
      ├── type: "BP"
      ├── connected: true
      ├── lastSeen: timestamp
      └── measurements/              # Subcollection
          └── {measurementId}/
              ├── systolic: 120
              ├── diastolic: 80
              ├── heartRate: 75
              └── timestamp: timestamp

/measurements/                      # Global measurements
  └── {measurementId}/
      ├── deviceId: "device123"
      ├── type: "BP"
      ├── systolic: 120
      ├── diastolic: 80
      └── timestamp: timestamp
```

## 🧪 **Test Firebase Integration**

### **Test 1: Health Check**
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "Firebase",
  "timestamp": "2024-01-30T...",
  "uptime": 1.234
}
```

### **Test 2: Register Device**
```bash
curl -X POST http://localhost:3000/api/devices/test123/connect \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test BP Monitor",
    "model": "BP2", 
    "type": "BP",
    "macAddress": "AA:BB:CC:DD:EE:FF"
  }'
```

### **Test 3: Send Measurement**
```bash
curl -X POST http://localhost:3000/api/bp/test123/measurement \
  -H "Content-Type: application/json" \
  -d '{
    "systolic": 120,
    "diastolic": 80,
    "heartRate": 75
  }'
```

### **Test 4: Get Data**
```bash
curl http://localhost:3000/api/devices
curl http://localhost:3000/api/bp/test123/history
```

## 📱 **Android Integration**

### **Add Retrofit Dependencies** (`app/build.gradle`):
```gradle
dependencies {
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'
}
```

### **API Service** (`ApiService.kt`):
```kotlin
interface MedicalDeviceApi {
    @POST("api/devices/{deviceId}/connect")
    suspend fun registerDevice(
        @Path("deviceId") deviceId: String,
        @Body deviceData: DeviceRegistration
    ): Response<ApiResponse<Device>>
    
    @POST("api/bp/{deviceId}/measurement")
    suspend fun sendBPMeasurement(
        @Path("deviceId") deviceId: String,
        @Body measurement: BPMeasurement
    ): Response<ApiResponse<Measurement>>
    
    @GET("api/devices")
    suspend fun getDevices(): Response<ApiResponse<List<Device>>>
    
    @GET("api/bp/{deviceId}/history")
    suspend fun getBPHistory(
        @Path("deviceId") deviceId: String,
        @Query("limit") limit: Int = 50
    ): Response<ApiResponse<List<Measurement>>>
}

object ApiClient {
    private const val BASE_URL = "http://10.0.2.2:3000/" // Android emulator
    // private const val BASE_URL = "http://192.168.1.100:3000/" // Real device
    
    val api: MedicalDeviceApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(MedicalDeviceApi::class.java)
    }
}
```

### **Data Models**:
```kotlin
data class DeviceRegistration(
    val name: String,
    val model: String,
    val type: String,
    val macAddress: String,
    val battery: Int? = null
)

data class BPMeasurement(
    val systolic: Int,
    val diastolic: Int,
    val heartRate: Int
)

data class ApiResponse<T>(
    val success: Boolean,
    val message: String? = null,
    val data: T? = null,
    val error: String? = null
)
```

### **Modified Activity** (e.g., `BpmActivity.kt`):
```kotlin
class BpmActivity : AppCompatActivity() {
    private val api = ApiClient.api
    
    private fun initEventBus() {
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmBpResult)
            .observe(this) { event ->
                val data = event.data as BIOL.BpResult
                
                // Display locally (as before)
                binding.dataLog.text = "BP: ${data.sys}/${data.dia} mmHg, HR: ${data.hr}"
                
                // 🚀 Send to Node.js backend → Firebase
                sendToBackend(data)
            }
    }
    
    private fun sendToBackend(bpResult: BIOL.BpResult) {
        lifecycleScope.launch {
            try {
                // 1. Register device first (if not already)
                val deviceRegistration = DeviceRegistration(
                    name = "Blood Pressure Monitor",
                    model = "BPM",
                    type = "BP",
                    macAddress = deviceAddress
                )
                
                api.registerDevice(deviceAddress, deviceRegistration)
                
                // 2. Send measurement
                val measurement = BPMeasurement(
                    systolic = bpResult.sys,
                    diastolic = bpResult.dia,
                    heartRate = bpResult.hr
                )
                
                val response = api.sendBPMeasurement(deviceAddress, measurement)
                
                if (response.isSuccessful) {
                    runOnUiThread {
                        binding.dataLog.append("\n✅ Saved to Firebase!")
                    }
                } else {
                    runOnUiThread {
                        binding.dataLog.append("\n❌ Failed to save")
                    }
                }
                
            } catch (e: Exception) {
                Log.e("API", "Failed to send to backend", e)
                runOnUiThread {
                    binding.dataLog.append("\n❌ Network error")
                }
            }
        }
    }
}
```

## 🔒 **Firestore Security Rules**

In Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write to devices and measurements for now
    // TODO: Add authentication-based rules
    match /{document=**} {
      allow read, write: if true;
      // Later: allow read, write: if request.auth != null;
    }
  }
}
```

## 💰 **Cost Estimation**

For 100 devices sending data every 5 minutes:

- **Firestore writes**: ~288,000/month = $0.18
- **Firestore reads**: ~100,000/month = $0.06  
- **Storage**: ~1GB = $0.18
- **Total**: **~$0.50/month** 🎉

## 🚀 **Next Steps**

1. **Test the setup** with curl commands
2. **Modify one Android activity** to call APIs  
3. **Check Firebase Console** to see data appear
4. **Add authentication** for production
5. **Deploy to cloud** (Heroku, Railway, Google Cloud)

Your Node.js backend now saves everything to Firebase! 🔥🚀