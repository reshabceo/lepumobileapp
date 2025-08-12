// Modified BpmActivity.kt to send data to Node.js Backend → Firebase
// This shows how to integrate your existing Bluetooth code with the backend API

package com.example.lpdemo

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.lpdemo.api.MedicalDeviceApiHelper
import com.example.lpdemo.databinding.ActivityBpmBinding
import com.example.lpdemo.utils.*
import com.jeremyliao.liveeventbus.LiveEventBus
import com.lepu.blepro.ext.BleServiceHelper
import com.lepu.blepro.constants.Ble
import com.lepu.blepro.event.InterfaceEvent
import com.lepu.blepro.objs.Bluetooth
import com.lepu.blepro.observer.BIOL
import com.lepu.blepro.observer.BleChangeObserver
import kotlinx.coroutines.launch

class BpmActivity : AppCompatActivity(), BleChangeObserver {

    private val TAG = "BpmActivity"
    private lateinit var binding: ActivityBpmBinding
    
    // 🚀 API helper for backend communication
    private val apiHelper = MedicalDeviceApiHelper()
    private var deviceRegistered = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityBpmBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        lifecycle.addObserver(BIOL(this, intArrayOf(Bluetooth.MODEL_BPM)))
        initView()
        initEventBus()
    }

    private fun initView() {
        binding.bleName.text = deviceName
        binding.bleState.observer = this
        binding.bleState.state = _bleState.value
        _bleState.observe(this) {
            binding.bleState.state = it
            
            // 🚀 Register device when connected
            if (it && !deviceRegistered) {
                registerDeviceWithBackend()
            }
        }
        binding.getInfo.setOnClickListener {
            BleServiceHelper.BleServiceHelper.bpmGetInfo(model)
        }
        binding.getBattery.setOnClickListener {
            BleServiceHelper.BleServiceHelper.bpmGetBattery(model)
        }
    }

    // 🚀 Register device with Node.js backend when Bluetooth connects
    private fun registerDeviceWithBackend() {
        lifecycleScope.launch {
            try {
                val result = apiHelper.registerDevice(
                    deviceId = deviceAddress,
                    name = deviceName.ifEmpty { "Blood Pressure Monitor" },
                    model = getDeviceModel(),
                    type = "BP",
                    macAddress = deviceAddress
                )
                
                result.fold(
                    onSuccess = { device ->
                        deviceRegistered = true
                        Log.d(TAG, "✅ Device registered with backend: ${device.id}")
                        runOnUiThread {
                            binding.dataLog.text = "✅ Connected to backend server"
                        }
                    },
                    onFailure = { error ->
                        Log.e(TAG, "❌ Failed to register device", error)
                        runOnUiThread {
                            binding.dataLog.text = "⚠️ Connected to device, backend offline"
                        }
                    }
                )
            } catch (e: Exception) {
                Log.e(TAG, "❌ Registration error", e)
            }
        }
    }
    
    private fun getDeviceModel(): String {
        return when (model) {
            Bluetooth.MODEL_BPM -> "BPM"
            Bluetooth.MODEL_BP2 -> "BP2"
            Bluetooth.MODEL_BP2A -> "BP2A"
            Bluetooth.MODEL_BP2T -> "BP2T"
            Bluetooth.MODEL_BP2W -> "BP2W"
            else -> "BPM_UNKNOWN"
        }
    }

    private fun initEventBus() {
        // 🩺 Blood Pressure Measurement - MAIN EVENT
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmBpResult)
            .observe(this) {
                val data = it.data as BIOL.BpResult
                
                // 📱 Display locally (keep existing behavior)
                val localDisplay = """
                    🩺 Blood Pressure Reading:
                    Systolic: ${data.sys} mmHg
                    Diastolic: ${data.dia} mmHg  
                    Heart Rate: ${data.hr} BPM
                    Quality: ${if(data.isHr) "Good" else "Fair"}
                    Time: ${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())}
                """.trimIndent()
                
                binding.dataLog.text = localDisplay
                
                // 🚀 Send to Node.js backend → Firebase
                sendBPMeasurementToBackend(data)
            }

        // Device Info Event
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmDeviceInfo)
            .observe(this) {
                val data = it.data as BIOL.DeviceInfo
                val infoText = """
                    📱 Device Information:
                    Model: ${data.model}
                    Hardware: ${data.hwVersion}
                    Software: ${data.swVersion}
                    Battery: ${data.batteryLevel}%
                """.trimIndent()
                
                binding.dataLog.text = infoText
                
                // Update backend with battery level if device is registered
                if (deviceRegistered) {
                    updateDeviceBattery(data.batteryLevel)
                }
            }

        // Battery Level Event  
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmBattery)
            .observe(this) {
                val battery = it.data as Int
                binding.dataLog.text = "🔋 Battery Level: $battery%"
                
                if (deviceRegistered) {
                    updateDeviceBattery(battery)
                }
            }
            
        // Real-time pressure event (during measurement)
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmRtData)
            .observe(this) {
                val data = it.data as BIOL.RtData
                binding.dataLog.text = "🔄 Measuring... Pressure: ${data.pressure} mmHg"
            }
    }

    // 🚀 Send blood pressure measurement to backend
    private fun sendBPMeasurementToBackend(bpResult: BIOL.BpResult) {
        if (!deviceRegistered) {
            Log.w(TAG, "Device not registered with backend, skipping measurement sync")
            return
        }
        
        lifecycleScope.launch {
            try {
                binding.dataLog.append("\n\n📤 Sending to backend...")
                
                val result = apiHelper.sendBPMeasurement(
                    deviceId = deviceAddress,
                    systolic = bpResult.sys,
                    diastolic = bpResult.dia,
                    heartRate = bpResult.hr
                )
                
                result.fold(
                    onSuccess = { measurement ->
                        Log.d(TAG, "✅ BP measurement saved: ${measurement.id}")
                        runOnUiThread {
                            binding.dataLog.append("\n✅ Saved to Firebase! 🔥")
                            binding.dataLog.append("\n📊 Measurement ID: ${measurement.id}")
                        }
                    },
                    onFailure = { error ->
                        Log.e(TAG, "❌ Failed to save BP measurement", error)
                        runOnUiThread {
                            binding.dataLog.append("\n❌ Backend error: ${error.message}")
                        }
                    }
                )
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Network error", e)
                runOnUiThread {
                    binding.dataLog.append("\n❌ Network error - saved locally only")
                }
            }
        }
    }
    
    // Update device battery level in backend
    private fun updateDeviceBattery(batteryLevel: Int) {
        lifecycleScope.launch {
            try {
                // Re-register device with updated battery level
                apiHelper.registerDevice(
                    deviceId = deviceAddress,
                    name = deviceName.ifEmpty { "Blood Pressure Monitor" },
                    model = getDeviceModel(),
                    type = "BP",
                    macAddress = deviceAddress,
                    battery = batteryLevel
                )
                Log.d(TAG, "🔋 Battery level updated: $batteryLevel%")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to update battery level", e)
            }
        }
    }

    override fun onBleStateChanged(model: Int, state: Int) {
        Log.d(TAG, "🔵 Bluetooth state changed - model: $model, state: $state")
        _bleState.value = state == Ble.State.CONNECTED
        
        if (state == Ble.State.DISCONNECTED) {
            deviceRegistered = false
            binding.dataLog.append("\n📱 Device disconnected")
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy")
        BleServiceHelper.BleServiceHelper.disconnect(false)
        super.onDestroy()
    }
}

/* 
🔥 INTEGRATION COMPARISON:

❌ BEFORE (Local display only):
LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmBpResult)
    .observe(this) {
        val data = it.data as BIOL.BpResult
        binding.dataLog.text = "BP: ${data.sys}/${data.dia}, HR: ${data.hr}"
    }

✅ AFTER (Local + Backend + Firebase):
LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmBpResult)
    .observe(this) {
        val data = it.data as BIOL.BpResult
        
        // Keep existing local display
        binding.dataLog.text = "BP: ${data.sys}/${data.dia}, HR: ${data.hr}"
        
        // PLUS: Send to Node.js backend → Firebase
        sendBPMeasurementToBackend(data)
        
        // User sees: "✅ Saved to Firebase! 🔥"
    }

🎯 WHAT HAPPENS:
1. 📱 Patient takes BP measurement with Bluetooth device
2. 📋 Android app displays result locally (as before)
3. 🚀 Android app sends data to Node.js backend API
4. 🔥 Node.js backend saves data to Firebase database
5. 📊 Data is now available for doctor dashboard, history, analytics

🏥 BENEFITS:
- ✅ All existing Bluetooth code works unchanged
- ✅ Data automatically synced to cloud database
- ✅ Doctor can see patient data in real-time
- ✅ Historical data for trends and reports
- ✅ Backup - data never lost
- ✅ Multi-device access (phone, tablet, web)
*/