// Add this to your Android app
// File: app/src/main/java/com/example/lpdemo/api/ApiService.kt

package com.example.lpdemo.api

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.lepu.blepro.ext.BleServiceHelper
import android.util.Log

// Data classes for API communication
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
    val unit: String = "mmHg"
)

data class ECGData(
    val heartRate: Int,
    val waveformData: List<Float>,
    val samplingRate: Int = 125,
    val duration: Int,
    val leadOff: Boolean = false
)

data class OximeterData(
    val spo2: Int,
    val pulseRate: Int,
    val pi: Float,
    val probeOff: Boolean = false,
    val pulseSearching: Boolean = false
)

data class GlucoseData(
    val value: Float,
    val unit: String = "mg/dL",
    val result: String,
    val testType: String = "random"
)

data class ApiResponse<T>(
    val success: Boolean,
    val message: String?,
    val data: T?,
    val error: String?
)

// Retrofit API interface
interface MedicalDeviceApi {
    @POST("devices/{deviceId}/connect")
    suspend fun connectDevice(
        @Path("deviceId") deviceId: String,
        @Body deviceInfo: DeviceInfo
    ): ApiResponse<Any>

    @POST("bp/{deviceId}/measurement")
    suspend fun sendBPMeasurement(
        @Path("deviceId") deviceId: String,
        @Body measurement: BPMeasurement
    ): ApiResponse<Any>

    @POST("ecg/{deviceId}/data")
    suspend fun sendECGData(
        @Path("deviceId") deviceId: String,
        @Body ecgData: ECGData
    ): ApiResponse<Any>

    @POST("oximeter/{deviceId}/measurement")
    suspend fun sendOximeterData(
        @Path("deviceId") deviceId: String,
        @Body oximeterData: OximeterData
    ): ApiResponse<Any>

    @POST("glucose/{deviceId}/measurement")
    suspend fun sendGlucoseData(
        @Path("deviceId") deviceId: String,
        @Body glucoseData: GlucoseData
    ): ApiResponse<Any>
}

// API Service class
class MedicalDeviceApiService {
    companion object {
        private const val BASE_URL = "http://10.0.2.2:3000/api/" // For Android emulator
        // Use "http://your-actual-ip:3000/api/" for real device
        private const val TAG = "MedicalDeviceAPI"
    }

    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    private val api = retrofit.create(MedicalDeviceApi::class.java)

    // Register device with backend when connected via Bluetooth
    suspend fun connectDevice(deviceId: String, deviceInfo: DeviceInfo) {
        try {
            val response = api.connectDevice(deviceId, deviceInfo)
            Log.d(TAG, "Device connected to backend: ${response.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect device to backend", e)
        }
    }

    // Send BP measurement to backend
    suspend fun sendBPMeasurement(deviceId: String, measurement: BPMeasurement) {
        try {
            val response = api.sendBPMeasurement(deviceId, measurement)
            Log.d(TAG, "BP measurement sent: ${response.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send BP measurement", e)
        }
    }

    // Send ECG data to backend
    suspend fun sendECGData(deviceId: String, ecgData: ECGData) {
        try {
            val response = api.sendECGData(deviceId, ecgData)
            Log.d(TAG, "ECG data sent: ${response.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send ECG data", e)
        }
    }

    // Send oximeter data to backend
    suspend fun sendOximeterData(deviceId: String, oximeterData: OximeterData) {
        try {
            val response = api.sendOximeterData(deviceId, oximeterData)
            Log.d(TAG, "Oximeter data sent: ${response.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send oximeter data", e)
        }
    }

    // Send glucose data to backend
    suspend fun sendGlucoseData(deviceId: String, glucoseData: GlucoseData) {
        try {
            val response = api.sendGlucoseData(deviceId, glucoseData)
            Log.d(TAG, "Glucose data sent: ${response.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send glucose data", e)
        }
    }
}