// Android API Service to connect to Node.js Backend (which connects to Firebase)
// Place this in: app/src/main/java/com/example/lpdemo/api/

package com.example.lpdemo.api

import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit

// 📡 API Interface - matches your Node.js backend endpoints
interface MedicalDeviceApi {
    
    // Register device with backend
    @POST("api/devices/{deviceId}/connect")
    suspend fun registerDevice(
        @Path("deviceId") deviceId: String,
        @Body deviceData: DeviceRegistration
    ): Response<ApiResponse<Device>>
    
    // 🩺 Blood Pressure
    @POST("api/bp/{deviceId}/measurement")
    suspend fun sendBPMeasurement(
        @Path("deviceId") deviceId: String,
        @Body measurement: BPMeasurement
    ): Response<ApiResponse<Measurement>>
    
    // 📈 ECG Data
    @POST("api/ecg/{deviceId}/data")
    suspend fun sendECGData(
        @Path("deviceId") deviceId: String,
        @Body data: ECGData
    ): Response<ApiResponse<Measurement>>
    
    // 🫁 Pulse Oximeter
    @POST("api/oximeter/{deviceId}/measurement")
    suspend fun sendOximeterMeasurement(
        @Path("deviceId") deviceId: String,
        @Body measurement: OximeterMeasurement
    ): Response<ApiResponse<Measurement>>
    
    // 🩸 Blood Glucose
    @POST("api/glucose/{deviceId}/measurement")
    suspend fun sendGlucoseMeasurement(
        @Path("deviceId") deviceId: String,
        @Body measurement: GlucoseMeasurement
    ): Response<ApiResponse<Measurement>>
    
    // 📋 Get all devices
    @GET("api/devices")
    suspend fun getDevices(): Response<ApiResponse<List<Device>>>
    
    // 📊 Get device history
    @GET("api/{type}/{deviceId}/history")
    suspend fun getDeviceHistory(
        @Path("type") type: String,
        @Path("deviceId") deviceId: String,
        @Query("limit") limit: Int = 50
    ): Response<ApiResponse<List<Measurement>>>
    
    // 📈 Get measurements by type
    @GET("api/measurements/{type}")
    suspend fun getMeasurementsByType(
        @Path("type") type: String,
        @Query("limit") limit: Int = 100
    ): Response<ApiResponse<List<Measurement>>>
}

// 🌐 API Client Singleton
object ApiClient {
    // Change this to your backend server IP
    private const val BASE_URL = "http://10.0.2.2:3000/"  // Android emulator
    // private const val BASE_URL = "http://192.168.1.100:3000/"  // Real device on your network
    // private const val BASE_URL = "https://your-app.herokuapp.com/"  // Production
    
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }
    
    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    val api: MedicalDeviceApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(MedicalDeviceApi::class.java)
    }
}

// 📊 Data Models
data class DeviceRegistration(
    val name: String,
    val model: String,
    val type: String,  // "BP", "ECG", "OXIMETER", "GLUCOSE"
    val macAddress: String,
    val battery: Int? = null,
    val firmware: String? = null
)

data class Device(
    val id: String,
    val name: String,
    val model: String,
    val type: String,
    val macAddress: String,
    val connected: Boolean,
    val lastSeen: String,
    val battery: Int?,
    val firmware: String?
)

data class BPMeasurement(
    val systolic: Int,
    val diastolic: Int,
    val heartRate: Int,
    val quality: String? = "good"  // good, fair, poor
)

data class ECGData(
    val heartRate: Int,
    val rrInterval: Int? = null,
    val qrsWidth: Int? = null,
    val waveform: List<Float>? = null,  // ECG waveform data
    val duration: Int = 30  // seconds
)

data class OximeterMeasurement(
    val spo2: Int,  // Oxygen saturation percentage
    val heartRate: Int,
    val perfusionIndex: Float? = null
)

data class GlucoseMeasurement(
    val glucose: Float,
    val unit: String = "mg/dL",  // mg/dL or mmol/L
    val beforeAfterMeal: String? = "before"  // before, after
)

data class Measurement(
    val id: String,
    val deviceId: String,
    val type: String,
    val timestamp: String,
    // Additional fields will vary by measurement type
    val data: Map<String, Any>
)

data class ApiResponse<T>(
    val success: Boolean,
    val message: String? = null,
    val data: T? = null,
    val device: T? = null,      // For device registration
    val devices: T? = null,     // For device list
    val measurement: T? = null, // For single measurement
    val measurements: T? = null, // For measurement list
    val count: Int? = null,
    val error: String? = null
)

// 🛠️ API Helper Class
class MedicalDeviceApiHelper {
    private val api = ApiClient.api
    
    // Register device (call once when device connects)
    suspend fun registerDevice(
        deviceId: String, 
        name: String, 
        model: String, 
        type: String, 
        macAddress: String,
        battery: Int? = null
    ): Result<Device> {
        return try {
            val deviceData = DeviceRegistration(name, model, type, macAddress, battery)
            val response = api.registerDevice(deviceId, deviceData)
            
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.device!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to register device"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // Send blood pressure measurement
    suspend fun sendBPMeasurement(
        deviceId: String,
        systolic: Int,
        diastolic: Int,
        heartRate: Int
    ): Result<Measurement> {
        return try {
            val measurement = BPMeasurement(systolic, diastolic, heartRate)
            val response = api.sendBPMeasurement(deviceId, measurement)
            
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.measurement!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to send BP measurement"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // Send ECG data
    suspend fun sendECGData(
        deviceId: String,
        heartRate: Int,
        waveform: List<Float>? = null
    ): Result<Measurement> {
        return try {
            val ecgData = ECGData(heartRate, waveform = waveform)
            val response = api.sendECGData(deviceId, ecgData)
            
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.measurement!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to send ECG data"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // Send oximeter measurement
    suspend fun sendOximeterMeasurement(
        deviceId: String,
        spo2: Int,
        heartRate: Int
    ): Result<Measurement> {
        return try {
            val measurement = OximeterMeasurement(spo2, heartRate)
            val response = api.sendOximeterMeasurement(deviceId, measurement)
            
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.measurement!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to send oximeter measurement"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // Send glucose measurement
    suspend fun sendGlucoseMeasurement(
        deviceId: String,
        glucose: Float,
        unit: String = "mg/dL"
    ): Result<Measurement> {
        return try {
            val measurement = GlucoseMeasurement(glucose, unit)
            val response = api.sendGlucoseMeasurement(deviceId, measurement)
            
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.measurement!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to send glucose measurement"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // Get all devices
    suspend fun getAllDevices(): Result<List<Device>> {
        return try {
            val response = api.getDevices()
            
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.devices ?: emptyList())
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to get devices"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // Get device measurement history
    suspend fun getDeviceHistory(deviceId: String, type: String, limit: Int = 50): Result<List<Measurement>> {
        return try {
            val response = api.getDeviceHistory(type, deviceId, limit)
            
            if (response.isSuccessful && response.body()?.success == true) {
                Result.success(response.body()!!.measurements ?: emptyList())
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to get device history"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

/* 
🔥 USAGE EXAMPLES:

// In your activity:
class BpmActivity : AppCompatActivity() {
    private val apiHelper = MedicalDeviceApiHelper()
    
    private fun handleBPMeasurement(bpResult: BIOL.BpResult) {
        lifecycleScope.launch {
            // Send to backend
            val result = apiHelper.sendBPMeasurement(
                deviceId = deviceAddress,
                systolic = bpResult.sys,
                diastolic = bpResult.dia,
                heartRate = bpResult.hr
            )
            
            result.fold(
                onSuccess = { measurement ->
                    runOnUiThread {
                        binding.dataLog.append("\n✅ Saved to Firebase via backend!")
                    }
                },
                onFailure = { error ->
                    Log.e("API", "Failed to send measurement", error)
                    runOnUiThread {
                        binding.dataLog.append("\n❌ Failed: ${error.message}")
                    }
                }
            )
        }
    }
}
*/