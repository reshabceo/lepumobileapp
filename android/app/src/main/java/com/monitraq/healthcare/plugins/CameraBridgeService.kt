package com.monitraq.healthcare.plugins

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.monitraq.healthcare.MainActivity
import com.monitraq.healthcare.R

/**
 * Foreground service running gomobile `mobile.Bridge` (RTSP → WHIP).
 * Requires `libs/camerabridge.aar` from `gomobile bind` (see camera-bridge-core/Makefile).
 */
class CameraBridgeService : Service() {

    companion object {
        const val ACTION_START = "com.monitraq.healthcare.camera_bridge.START"
        const val ACTION_STOP = "com.monitraq.healthcare.camera_bridge.STOP"
        const val EXTRA_RTSP = "rtsp_url"
        const val EXTRA_SFU = "sfu_origin"
        const val EXTRA_PATIENT = "patient_id"
        const val EXTRA_JWT = "jwt"
        const val EXTRA_ICE = "ice_json"
        const val EXTRA_UDP = "use_udp"
        private const val NOTIF_CHANNEL = "monitraq_live_rpm"
        private const val NOTIF_ID = 91042
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var bridgeInst: Any? = null
    private var bridgeStart: java.lang.reflect.Method? = null
    private var bridgeStop: java.lang.reflect.Method? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                haltBridge()
                stopForeground(Service.STOP_FOREGROUND_REMOVE)
                releaseWakeLock()
                stopSelf()
                CameraBridgePlugin.emitState("idle")
                return START_NOT_STICKY
            }
            ACTION_START -> {
                acquireWakeLock()
                val rtsp = intent.getStringExtra(EXTRA_RTSP) ?: ""
                val sfu = intent.getStringExtra(EXTRA_SFU) ?: ""
                val patient = intent.getStringExtra(EXTRA_PATIENT) ?: ""
                val jwt = intent.getStringExtra(EXTRA_JWT) ?: ""
                val ice = intent.getStringExtra(EXTRA_ICE) ?: ""
                val useUdp = intent.getBooleanExtra(EXTRA_UDP, false)
                showForegroundNotification(rtsp)
                startBridge(rtsp, sfu, patient, jwt, ice, useUdp)
            }
        }
        return START_STICKY
    }

    private fun ensureLoaded(): Boolean {
        if (bridgeInst != null && bridgeStart != null && bridgeStop != null) return true
        return try {
            val k = Class.forName("mobile.Bridge")
            bridgeInst = k.getConstructor().newInstance()
            bridgeStart =
                k.getMethod(
                    "Start",
                    String::class.java,
                    String::class.java,
                    String::class.java,
                    String::class.java,
                    String::class.java,
                    java.lang.Boolean.TYPE,
                    String::class.java,
                    Class.forName("mobile.StatusListener"),
                )
            bridgeStop = k.getMethod("Stop")
            true
        } catch (e: Throwable) {
            bridgeInst = null
            bridgeStart = null
            bridgeStop = null
            CameraBridgePlugin.emitError(
                "Native camerabridge.aar missing. Build with ANDROID_HOME: ${e.message}",
            )
            false
        }
    }

    private fun startBridge(
        rtsp: String,
        sfu: String,
        patient: String,
        jwt: String,
        ice: String,
        useUdp: Boolean,
    ) {
        if (!ensureLoaded()) return
        try {
            bridgeStop?.invoke(bridgeInst)
        } catch (_: Throwable) {}

        val listenerCls = Class.forName("mobile.StatusListener")
        val listener =
            java.lang.reflect.Proxy.newProxyInstance(listenerCls.classLoader, arrayOf(listenerCls)) {
                _: Any?,
                method: java.lang.reflect.Method,
                args: Array<out Any?>?,
                ->
                when (method.name) {
                    "OnState" -> {
                        val s = args?.getOrNull(0) as? String
                        if (s != null) CameraBridgePlugin.emitState(s)
                    }
                    "OnError" -> {
                        val s = args?.getOrNull(0) as? String
                        if (s != null) CameraBridgePlugin.emitError(s)
                    }
                    "OnBytes" -> {
                        val n = (args?.getOrNull(0) as? Long) ?: 0L
                        CameraBridgePlugin.emitBytes(n)
                    }
                }
                null
            }

        try {
            bridgeStart?.invoke(bridgeInst, rtsp, sfu, patient, jwt, ice, useUdp, "", listener)
            CameraBridgePlugin.emitState("connecting")
        } catch (e: Throwable) {
            CameraBridgePlugin.emitError(e.message ?: "camera bridge failed to start")
        }
    }

    private fun haltBridge() {
        try {
            bridgeStop?.invoke(bridgeInst)
        } catch (_: Throwable) {}
    }

    private fun acquireWakeLock() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (wakeLock == null || wakeLock?.isHeld == false) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "monitraq:CameraBridge")
                wakeLock?.setReferenceCounted(false)
                wakeLock?.acquire(10 * 60 * 60 * 1000L)
            }
        } catch (_: Throwable) {}
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let { wl -> if (wl.isHeld) wl.release() }
        } catch (_: Throwable) {}
        wakeLock = null
    }

    private fun showForegroundNotification(shortHint: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(
                    NOTIF_CHANNEL,
                    "Live RPM bridge",
                    NotificationManager.IMPORTANCE_LOW,
                ),
            )
        }
        val open =
            PendingIntent.getActivity(
                this,
                0,
                Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

        val b =
            NotificationCompat.Builder(this, NOTIF_CHANNEL)
                .setContentTitle(resources.getString(R.string.app_name))
                .setContentText(resources.getString(R.string.camera_bridge_notification_text))
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .setContentIntent(open)

        if (shortHint.isNotEmpty()) {
            b.setContentText(shortHint.take(82))
        }

        val n: Notification = b.build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this,
                NOTIF_ID,
                n,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            startForeground(NOTIF_ID, n)
        }
    }

    override fun onDestroy() {
        haltBridge()
        releaseWakeLock()
        super.onDestroy()
    }
}
