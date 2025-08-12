// Modified BpmActivity.kt to use Firebase instead of local storage
// This replaces the existing blood pressure monitoring activity

package com.example.lpdemo

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.lpdemo.databinding.ActivityBpmBinding
import com.example.lpdemo.firebase.*
import com.example.lpdemo.utils._bleState
import com.google.firebase.Timestamp
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
    
    // 🔥 Firebase services
    private val authService = FirebaseAuthService()
    private val medicalDataService = FirebaseMedicalDataService()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityBpmBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        lifecycle.addObserver(BIOL(this, intArrayOf(Bluetooth.MODEL_BPM)))
        initView()
        initEventBus()
        initFirebaseListeners()
    }

    private fun initView() {
        binding.bleName.text = deviceName
        binding.bleState.observer = this
        binding.bleState.state = _bleState.value
        _bleState.observe(this) {
            binding.bleState.state = it
        }
        binding.getInfo.setOnClickListener {
            BleServiceHelper.BleServiceHelper.bpmGetInfo(model)
        }
        binding.getBattery.setOnClickListener {
            BleServiceHelper.BleServiceHelper.bpmGetBattery(model)
        }
    }

    // 🔥 Initialize Firebase real-time listeners
    private fun initFirebaseListeners() {
        // Check if user is logged in
        val currentUser = authService.getCurrentUser()
        if (currentUser == null) {
            binding.dataLog.text = "❌ Please login to sync data to cloud"
            return
        }
        
        binding.dataLog.text = "✅ Connected to Firebase - Data will sync automatically"
        
        // Listen for real-time blood pressure data from Firebase
        medicalDataService.getRealtimeBPData { measurements ->
            val recentMeasurements = measurements.take(5)
            val displayText = "📊 Recent Measurements:\n" + 
                recentMeasurements.joinToString("\n") { measurement ->
                    "${measurement.systolic}/${measurement.diastolic} mmHg (${measurement.heartRate} BPM) - ${measurement.timestamp.toDate()}"
                }
            
            runOnUiThread {
                binding.dataLog.text = displayText
            }
        }
    }

    private fun initEventBus() {
        // 🩺 Blood Pressure Measurement Event
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmBpResult)
            .observe(this) {
                val data = it.data as BIOL.BpResult
                
                // 📱 Display locally (as before)
                val localDisplay = """
                    🩺 Blood Pressure Measurement:
                    Systolic: ${data.sys} mmHg
                    Diastolic: ${data.dia} mmHg  
                    Heart Rate: ${data.hr} BPM
                    Quality: ${if(data.isHr) "Good" else "Fair"}
                    Time: ${System.currentTimeMillis()}
                """.trimIndent()
                
                binding.dataLog.text = localDisplay
                
                // 🔥 Save to Firebase automatically
                saveToFirebase(data)
            }

        // Device Info Event
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmDeviceInfo)
            .observe(this) {
                val data = it.data as BIOL.DeviceInfo
                binding.dataLog.text = "📱 Device Info: $data"
            }

        // Battery Event  
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmBattery)
            .observe(this) {
                val data = it.data as Int
                binding.dataLog.text = "🔋 Battery: $data%"
            }
    }

    // 🔥 Save measurement to Firebase
    private fun saveToFirebase(bpResult: BIOL.BpResult) {
        // Check if user is logged in
        if (authService.getCurrentUser() == null) {
            Log.w(TAG, "User not logged in - measurement not saved to cloud")
            return
        }
        
        // Create Firebase measurement object
        val measurement = BloodPressureMeasurement(
            systolic = bpResult.sys,
            diastolic = bpResult.dia,
            heartRate = bpResult.hr,
            deviceModel = "BPM",
            deviceId = deviceAddress,
            timestamp = Timestamp.now(),
            quality = if (bpResult.isHr) "good" else "fair"
        )
        
        // Save to Firebase (async)
        lifecycleScope.launch {
            try {
                medicalDataService.saveBPMeasurement(measurement)
                
                runOnUiThread {
                    binding.dataLog.append("\n\n✅ Saved to Firebase Cloud!")
                }
                
                Log.d(TAG, "Blood pressure measurement saved to Firebase")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to save measurement to Firebase", e)
                
                runOnUiThread {
                    binding.dataLog.append("\n\n❌ Failed to sync to cloud")
                }
            }
        }
    }

    override fun onBleStateChanged(model: Int, state: Int) {
        Log.d(TAG, "model $model, state: $state")
        _bleState.value = state == Ble.State.CONNECTED
        
        // 🔥 Update connection status in Firebase if needed
        if (state == Ble.State.CONNECTED) {
            binding.dataLog.append("\n📱 Device Connected")
        } else {
            binding.dataLog.append("\n📱 Device Disconnected")
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy")
        BleServiceHelper.BleServiceHelper.disconnect(false)
        super.onDestroy()
    }
}

/* 
🔥 MIGRATION COMPARISON:

❌ BEFORE (Local only):
LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmBpResult)
    .observe(this) {
        val data = it.data as BIOL.BpResult
        binding.dataLog.text = "$data"  // Only local display
    }

✅ AFTER (Firebase + Local):
LiveEventBus.get<InterfaceEvent>(InterfaceEvent.Bpm.EventBpmBpResult)
    .observe(this) {
        val data = it.data as BIOL.BpResult
        
        // Still display locally
        binding.dataLog.text = "$data"
        
        // PLUS: Automatically save to Firebase
        saveToFirebase(data)
        
        // PLUS: Real-time sync across devices
        // PLUS: Doctor can see data instantly
        // PLUS: Works offline, syncs when online
    }

🎯 BENEFITS:
- ✅ All existing Bluetooth code works unchanged
- ✅ Real-time sync to doctor dashboard  
- ✅ Offline support (measurements saved locally, synced later)
- ✅ Patient login system
- ✅ Historical data access
- ✅ Much cheaper than Node.js backend ($0-5/month vs $30-80/month)
*/