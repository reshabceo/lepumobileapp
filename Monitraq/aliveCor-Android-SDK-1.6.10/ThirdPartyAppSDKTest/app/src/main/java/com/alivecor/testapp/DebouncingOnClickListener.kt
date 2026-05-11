package com.alivecor.testapp


import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.View
import timber.log.Timber

abstract class DebouncingOnClickListener : View.OnClickListener {

    override fun onClick(v: View) {
        if (SystemClock.elapsedRealtime() - mLastClickTime < 1000L && viewId == v.id) {
            Timber.d("DebouncingOnClick blocked")
        } else {
            mLastClickTime = SystemClock.elapsedRealtime()
            if (enabled) {
                enabled = false
                MAIN.post(ENABLE_AGAIN)
                doClick(v)
                viewId = v.id
            }
        }
    }

    abstract fun doClick(var1: View)

    companion object {
        private val ENABLE_AGAIN = Runnable { enabled = true }
        private val MAIN = Handler(Looper.getMainLooper())
        var enabled = true
        private var mLastClickTime = 0L
        private var viewId = -1
    }
}
