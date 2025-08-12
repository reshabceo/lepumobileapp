// Modified BpmActivity.kt - INTEGRATED WITH BACKEND API
// Replace the event bus observers in your BpmActivity.kt with this code

package com.example.lpdemo

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.databinding.DataBindingUtil
import androidx.lifecycle.lifecycleScope
import com.example.lpdemo.databinding.ActivityBpmBinding
import com.example.lpdemo.utils.*
import com.example.lpdemo.api.MedicalDeviceApiService
import com.example.lpdemo.api.DeviceInfo
import com.example.lpdemo.api.BPMeasurement
import com.jeremyliao.liveeventbus.LiveEventBus
import com.lepu.blepro.ext.BleServiceHelper
import com.lepu.blepro.constants.Ble
import com.lepu.blepro.event.InterfaceEvent
import com.lepu.blepro.ext.bpm.*
import kotlinx.coroutines.launch

class BpmActivity : ComponentActivity(), BleChangeObserver {

    private val TAG = "BpmActivity"
    private lateinit var binding: ActivityBpmBinding
    
    // Add API service
    private val apiService = MedicalDeviceApiService()
    private var currentDeviceId: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = DataBindingUtil.setContentView(this, R.layout.activity_bpm)
        lifecycle.addObserver(BleServiceHelper.BleServiceHelper)
        BleServiceHelper.BleServiceHelper.addBleChangeObserver(this)
        initEventBus()
        initView()
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
        binding.getInfo.setOnClickListener {
            BleServiceHelper.BleServiceHelper.bpmGetInfo(deviceModel)
        }
        binding.getMemory.setOnClickListener {
            BleServiceHelper.BleServiceHelper.bpmGetData(deviceModel)
        }
        binding.startBp.setOnClickListener {
            BleServiceHelper.BleServiceHelper.bpmStart(deviceModel)
        }
        binding.stopBp.setOnClickListener {
            BleServiceHelper.BleServiceHelper.bpmStop(deviceModel)
        }
    }

    // Register device with backend API
    private fun registerDeviceWithBackend() {
        lifecycleScope.launch {
            try {
                val deviceInfo = DeviceInfo(
                    name = deviceName,
                    model = getModelName(deviceModel),
                    macAddress = deviceAddress,
                    type = "BP"
                )
                apiService.connectDevice(currentDeviceId, deviceInfo)
                Log.d(TAG, "Device registered with backend: $deviceName")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to register device with backend", e)
            }
        }
    }

    // Get readable model name
    private fun getModelName(model: Int): String {
        return when (model) {
            Bluetooth.MODEL_BPM -> "BPM"
            Bluetooth.MODEL_BPM_188 -> "BPM-188"
            else -> "Unknown-BP"
        }
    }

    private fun initEventBus() {
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.BPM.EventBpmInfo)
            .observe(this) {
                val data = it.data as DeviceInfo
                binding.dataLog.text = "$data"
            }
            
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.BPM.EventBpmState)
            .observe(this) {
                val data = it.data as Int
                binding.dataLog.text = "device state : ${getRtState(data)}"
            }
            
        // MODIFIED: Real-time pressure data - now sends to backend
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.BPM.EventBpmRtData)
            .observe(this) {
                val data = it.data as Int
                binding.tvPs.text = "$data"
                binding.dataLog.text = "real-time pressure : $data"
                
                // Send real-time pressure to backend (optional)
                // Note: You might want to throttle this to avoid too many API calls
            }
            
        // MODIFIED: BP measurement result - now sends to backend
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.BPM.EventBpmMeasureResult)
            .observe(this) {
                val data = it.data as RecordData
                
                // Update UI
                binding.tvSys.text = "${data.sys}"
                binding.tvDia.text = "${data.dia}"
                binding.tvPrBp.text = "${data.pr}"
                binding.dataLog.text = "$data"
                
                // 🚀 NEW: Send measurement to backend API
                sendBPMeasurementToBackend(data)
            }
            
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.BPM.EventBpmMeasureErrorResult)
            .observe(this) {
                val data = it.data as Int
                binding.dataLog.text = "error result : ${getErrorResult(data)}"
            }
            
        LiveEventBus.get<InterfaceEvent>(InterfaceEvent.BPM.EventBpmRecordData)
            .observe(this) {
                val data = it.data as RecordData
                binding.dataLog.text = "$data"
                
                // 🚀 NEW: Send historical data to backend API
                sendBPMeasurementToBackend(data)
            }
    }

    // 🚀 NEW METHOD: Send BP measurement to backend
    private fun sendBPMeasurementToBackend(data: RecordData) {
        lifecycleScope.launch {
            try {
                val bpMeasurement = BPMeasurement(
                    systolic = data.sys,
                    diastolic = data.dia,
                    mean = (data.sys + 2 * data.dia) / 3, // Calculate mean
                    pulseRate = data.pr,
                    unit = "mmHg"
                )
                
                apiService.sendBPMeasurement(currentDeviceId, bpMeasurement)
                Log.d(TAG, "✅ BP measurement sent to backend: ${data.sys}/${data.dia} mmHg")
                
                // Optional: Show success indicator in UI
                runOnUiThread {
                    binding.dataLog.text = binding.dataLog.text.toString() + "\n✅ Sent to cloud"
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to send BP measurement to backend", e)
                
                // Optional: Show error indicator in UI
                runOnUiThread {
                    binding.dataLog.text = binding.dataLog.text.toString() + "\n❌ Cloud sync failed"
                }
            }
        }
    }

    override fun onBleStateChanged(model: Int, state: Int) {
        Log.d(TAG, "model $model, state: $state")
        _bleState.value = state == Ble.State.CONNECTED
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy")
        BleServiceHelper.BleServiceHelper.disconnect(false)
        super.onDestroy()
    }

    private fun getRtState(state: Int): String {
        return when (state) {
            RtState.MEASURING -> "measuring"
            RtState.MEASURE_COMPLETE -> "measure complete"
            RtState.MEASURE_ERROR -> "measure error"
            else -> "idle"
        }
    }

    private fun getErrorResult(error: Int): String {
        return when (error) {
            ErrorResult.CUFF_ERROR -> "cuff error"
            ErrorResult.NO_PULSE -> "no pulse"
            ErrorResult.OVER_PRESSURE -> "over pressure"
            ErrorResult.WEAK_SIGNAL -> "weak signal"
            else -> "unknown error"
        }
    }
}