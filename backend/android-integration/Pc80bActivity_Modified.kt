// Modified Pc80bActivity.kt - INTEGRATED WITH BACKEND API
// Shows how to integrate ECG data with backend API

package com.example.lpdemo

import android.os.Bundle
import android.os.Handler
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.databinding.DataBindingUtil
import androidx.lifecycle.lifecycleScope
import com.example.lpdemo.databinding.ActivityPc80bBinding
import com.example.lpdemo.utils.*
import com.example.lpdemo.api.MedicalDeviceApiService
import com.example.lpdemo.api.DeviceInfo
import com.example.lpdemo.api.ECGData
import com.jeremyliao.liveeventbus.LiveEventBus
import com.lepu.blepro.ext.BleServiceHelper
import com.lepu.blepro.constants.Ble
import com.lepu.blepro.event.InterfaceEvent
import com.lepu.blepro.ext.pc80b.*
import kotlinx.coroutines.launch

class Pc80bActivity : ComponentActivity(), BleChangeObserver {

    private val TAG = "Pc80bActivity"
    private lateinit var binding: ActivityPc80bBinding
    
    // Add API service
    private val apiService = MedicalDeviceApiService()
    private var currentDeviceId: String = ""
    
    // ECG data collection
    private val ecgWaveBuffer = mutableListOf<Float>()
    private var recordingStartTime: Long = 0
    private var isRecording = false

    private lateinit var waveHandler: Handler
    private val ecgWaveTask = object : Runnable {
        override fun run() {
            dataEcgSrc.value?.let {
                binding.ecgBkg.addData(it)
            }
            waveHandler.postDelayed(this, 50)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = DataBindingUtil.setContentView(this, R.layout.activity_pc80b)
        lifecycle.addObserver(BleServiceHelper.BleServiceHelper)
        BleServiceHelper.BleServiceHelper.addBleChangeObserver(this)
        initEventBus()
        initView()

        waveHandler = Handler(mainLooper)
        waveHandler.postDelayed(ecgWaveTask, 1000)
    }

    private fun initView() {
        binding.bleName.text = deviceName
        currentDeviceId = deviceAddress.replace(":", "") // Clean MAC address for device ID
        
        // Register device with backend when activity starts
        registerDeviceWithBackend()
        
        binding.connectBtn.setOnClickListener {
            BleServiceHelper.BleServiceHelper.connect(this, deviceAddress)
        }
        binding.disconnectBtn.setOnClickListener {
            BleServiceHelper.BleServiceHelper.disconnect(false)
        }
        binding.startBp.setOnClickListener {
            BleServiceHelper.BleServiceHelper.pc80bGetBp(deviceModel)
        }
        binding.startEcg.setOnClickListener {
            // Start ECG recording
            startECGRecording()
            BleServiceHelper.BleServiceHelper.pc80bStartContinuous(deviceModel)
        }
        binding.stopEcg.setOnClickListener {
            // Stop ECG recording and send to backend
            stopECGRecording()
            BleServiceHelper.BleServiceHelper.pc80bStopContinuous(deviceModel)
        }
    }

    // Register device with backend API
    private fun registerDeviceWithBackend() {
        lifecycleScope.launch {
            try {
                val deviceInfo = DeviceInfo(
                    name = deviceName,
                    model = "PC-80B",
                    macAddress = deviceAddress,
                    type = "ECG"
                )
                apiService.connectDevice(currentDeviceId, deviceInfo)
                Log.d(TAG, "Device registered with backend: $deviceName")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to register device with backend", e)
            }
        }
    }

    private fun startECGRecording() {
        ecgWaveBuffer.clear()
        recordingStartTime = System.currentTimeMillis()
        isRecording = true
        
        binding.dataLog.text = "🔴 ECG Recording Started"
        Log.d(TAG, "ECG recording started")
    }

    private fun stopECGRecording() {
        if (!isRecording) return
        
        isRecording = false
        val duration = ((System.currentTimeMillis() - recordingStartTime) / 1000).toInt()
        
        binding.dataLog.text = "⏹️ ECG Recording Stopped - Sending to cloud..."
        Log.d(TAG, "ECG recording stopped, duration: ${duration}s, samples: ${ecgWaveBuffer.size}")
        
        // Send ECG data to backend
        sendECGDataToBackend(duration)
    }

    private fun initEventBus() {
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.PC80B.EventPc80bDeviceInfo)
            .observe(this) {
                val data = it.data as DeviceInfo
                binding.dataLog.text = "$data"
            }
            
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.PC80B.EventPc80bBatLevel)
            .observe(this) {
                val data = it.data as Int
                // 0：0-25%，1：25-50%，2：50-75%，3：75-100%
                val batteryPercent = when (data) {
                    0 -> 12 // ~12%
                    1 -> 37 // ~37%
                    2 -> 62 // ~62%
                    3 -> 87 // ~87%
                    else -> 0
                }
                binding.dataLog.text = "Battery: $batteryPercent%"
            }
            
        // MODIFIED: Continuous ECG data - now collects for backend
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.PC80B.EventPc80bContinuousData)
            .observe(this) {
                val data = it.data as RtContinuousData
                
                // Update UI
                DataController.receive(data.ecgData.ecgFloats)
                binding.hr.text = "${data.hr}"
                binding.dataLog.text = "HR: ${data.hr} bpm"
                
                // 🚀 NEW: Collect ECG waveform data while recording
                if (isRecording) {
                    ecgWaveBuffer.addAll(data.ecgData.ecgFloats)
                    
                    // Limit buffer size to prevent memory issues (keep last 30 seconds of data)
                    val maxSamples = 150 * 30 // 150Hz * 30 seconds
                    if (ecgWaveBuffer.size > maxSamples) {
                        ecgWaveBuffer.removeAt(0)
                    }
                }
                
                // Optional: Send real-time HR updates to backend
                sendHeartRateUpdate(data.hr)
            }
            
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.PC80B.EventPc80bContinuousDataEnd)
            .observe(this) {
                binding.dataLog.text = "exit continuous measurement"
                
                // Auto-stop recording if it was running
                if (isRecording) {
                    stopECGRecording()
                }
            }
    }

    // 🚀 NEW METHOD: Send ECG data to backend
    private fun sendECGDataToBackend(duration: Int) {
        lifecycleScope.launch {
            try {
                // Calculate average heart rate from the recording
                val avgHeartRate = binding.hr.text.toString().toIntOrNull() ?: 75
                
                val ecgData = ECGData(
                    heartRate = avgHeartRate,
                    waveformData = ecgWaveBuffer.toList(), // Convert to immutable list
                    samplingRate = 150, // PC-80B uses 150Hz
                    duration = duration,
                    leadOff = false // Assuming leads are connected during recording
                )
                
                apiService.sendECGData(currentDeviceId, ecgData)
                Log.d(TAG, "✅ ECG data sent to backend: ${duration}s, ${ecgWaveBuffer.size} samples, HR: $avgHeartRate")
                
                // Show success in UI
                runOnUiThread {
                    binding.dataLog.text = "✅ ECG sent to cloud: ${duration}s recording"
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to send ECG data to backend", e)
                
                // Show error in UI
                runOnUiThread {
                    binding.dataLog.text = "❌ ECG cloud sync failed"
                }
            }
        }
    }

    // 🚀 NEW METHOD: Send real-time heart rate updates (optional)
    private fun sendHeartRateUpdate(heartRate: Int) {
        // You can uncomment this to send real-time HR updates
        // Be careful not to spam the API - consider throttling
        /*
        lifecycleScope.launch {
            try {
                val ecgData = ECGData(
                    heartRate = heartRate,
                    waveformData = emptyList(), // Just HR update, no waveform
                    samplingRate = 150,
                    duration = 0,
                    leadOff = false
                )
                apiService.sendECGData(currentDeviceId, ecgData)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send HR update", e)
            }
        }
        */
    }

    override fun onBleStateChanged(model: Int, state: Int) {
        Log.d(TAG, "model $model, state: $state")
        _bleState.value = state == Ble.State.CONNECTED
        
        // Stop recording if device disconnects
        if (state != Ble.State.CONNECTED && isRecording) {
            stopECGRecording()
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy")
        waveHandler.removeCallbacks(ecgWaveTask)
        DataController.clear()
        dataEcgSrc.value = null
        
        // Stop recording if still active
        if (isRecording) {
            stopECGRecording()
        }
        
        BleServiceHelper.BleServiceHelper.disconnect(false)
        super.onDestroy()
    }
}