package io.getstream.log.kotlin;

import java.text.DateFormat;

import io.getstream.log.AndroidStreamLogger;
import io.getstream.log.Priority;
import io.getstream.log.StreamLog;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.internal.DefaultConstructorMarker;

/**
 * Compatibility shim for older Wellue SDKs expecting class
 * io.getstream.log.kotlin.KotlinStreamLogger with specific constructors.
 *
 * Delegates to the current io.getstream.log APIs at runtime.
 */
public final class KotlinStreamLogger implements io.getstream.log.StreamLogger {
    public static final Companion Companion = new Companion();

    // Synthetic Kotlin constructor signature the vendor SDK expects
    public KotlinStreamLogger(DateFormat dateFormat,
                              Function0<String> threadNameSupplier,
                              int maxTagLength,
                              DefaultConstructorMarker marker) {
        tryInstall();
    }

    // Also provide a default constructor for safety
    public KotlinStreamLogger() {
        tryInstall();
    }

    private static void tryInstall() {
        try {
            StreamLog.install(new AndroidStreamLogger());
        } catch (Throwable ignored) {
        }
    }

    // Implement StreamLogger by delegating to AndroidStreamLogger
    @Override
    public void log(io.getstream.log.Priority priority, String tag, String message, Throwable throwable) {
        try {
            new AndroidStreamLogger().log(priority, tag, message, throwable);
        } catch (Throwable ignored) {
        }
    }

    public static void installPlatformStreamLogger() {
        tryInstall();
    }

    public static void installPlatformStreamLogger(Priority minPriority, int maxTagLength) {
        tryInstall();
    }

    public static final class Companion {
        public void installPlatformStreamLogger() {
            KotlinStreamLogger.installPlatformStreamLogger();
        }

        public void installPlatformStreamLogger(Priority minPriority, int maxTagLength) {
            KotlinStreamLogger.installPlatformStreamLogger(minPriority, maxTagLength);
        }
    }
}


