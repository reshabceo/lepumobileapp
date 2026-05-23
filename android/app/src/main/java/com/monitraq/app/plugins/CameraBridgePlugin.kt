package com.monitraq.app.plugins

import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.concurrent.atomic.AtomicLong

/**
 * Starts/stops RTSP→WHIP via [CameraBridgeService] and reflected `mobile.Bridge` from gomobile AAR.
 */
@CapacitorPlugin(name = "CameraBridge")
class CameraBridgePlugin : Plugin() {

    companion object {
        private val main = Handler(Looper.getMainLooper())
        @Volatile private var instance: CameraBridgePlugin? = null

        /** Last bridge byte counter from native (cumulative approximate). */
        private val lastBytes = AtomicLong(0L)

        fun emitState(s: String) {
            main.post {
                val js = JSObject()
                js.put("state", s)
                instance?.notifyListeners("cameraBridgeState", js)
            }
        }

        fun emitError(message: String) {
            main.post {
                val js = JSObject()
                js.put("error", message)
                instance?.notifyListeners("cameraBridgeError", js)
            }
        }

        fun emitBytes(n: Long) {
            lastBytes.set(n)
            main.post {
                val js = JSObject()
                js.put("bytesTransferred", n)
                instance?.notifyListeners("cameraBridgeBytes", js)
            }
        }
    }

    override fun load() {
        super.load()
        instance = this
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        if (instance === this) {
            instance = null
        }
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val rtsp = call.getString("rtspUrl")
        val patient = call.getString("patientId")
        val sfu = call.getString("sfuOrigin")
        val jwt = call.getString("jwt")
        if (rtsp.isNullOrBlank()) {
            call.reject("rtspUrl required")
            return
        }
        if (patient.isNullOrBlank()) {
            call.reject("patientId required")
            return
        }
        if (sfu.isNullOrBlank()) {
            call.reject("sfuOrigin required")
            return
        }
        if (jwt.isNullOrBlank()) {
            call.reject("jwt required")
            return
        }
        val ice = call.getString("iceJson") ?: ""

        lastBytes.set(0L)
        val i =
            Intent(context, CameraBridgeService::class.java).apply {
                action = CameraBridgeService.ACTION_START
                putExtra(CameraBridgeService.EXTRA_RTSP, rtsp)
                putExtra(CameraBridgeService.EXTRA_PATIENT, patient)
                putExtra(CameraBridgeService.EXTRA_SFU, sfu.trimEnd('/'))
                putExtra(CameraBridgeService.EXTRA_JWT, jwt)
                putExtra(CameraBridgeService.EXTRA_ICE, ice)
                putExtra(CameraBridgeService.EXTRA_UDP, call.getBoolean("useUdp", false))
            }

        ContextCompat.startForegroundService(context, i)

        val resp = JSObject()
        resp.put("ok", true)
        resp.put("state", "starting")
        call.resolve(resp)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        context.startService(
            Intent(context, CameraBridgeService::class.java).apply {
                action = CameraBridgeService.ACTION_STOP
            },
        )
        val resp = JSObject()
        resp.put("ok", true)
        call.resolve(resp)
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val js = JSObject()
        js.put("bytesTransferred", lastBytes.get())
        call.resolve(js)
    }
}
