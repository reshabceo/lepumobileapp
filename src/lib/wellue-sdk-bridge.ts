import { Capacitor } from '@capacitor/core';
// BLE fallback (static import so it exists on device builds)
import { BleClient } from '@capacitor-community/bluetooth-le';
import { registerPlugin } from '@capacitor/core';

// Core device interfaces
export interface WellueDevice {
    id: string;
    name: string;
    model: string;
    battery?: number;
    isConnected: boolean;
    rssi?: number;
    address?: string;
}

// BP measurement interfaces
export interface BPMeasurement {
    systolic: number;
    diastolic: number;
    pulseRate: number;
    timestamp: Date;
    quality: 'good' | 'fair' | 'poor';
    meanArterialPressure?: number;
}

export interface BPProgress {
    pressure: number;
    status: 'ready' | 'inflating' | 'holding' | 'deflating' | 'analyzing' | 'measuring';
    timestamp: Date;
}

export interface BPStatus {
    isMeasuring: boolean;
    currentPressure: number;
    status: 'idle' | 'ready' | 'starting' | 'inflating' | 'holding' | 'deflating' | 'analyzing' | 'measuring' | 'complete' | 'error';
    lastMeasurement?: BPMeasurement;
    error?: string;
}

// Real-time data interfaces
export interface RealTimeData {
    pressure?: number;          // Real-time pressure in mmHg (raw value / 100)
    heartRate?: number;
    pulse?: number;             // Alternative to heartRate
    progress?: number;
    deviceStatus?: number;
    batteryStatus?: number;
    batteryPercent?: number;    // Alternative to batteryStatus
    status?: number;            // Alternative to deviceStatus
    isDeflating?: boolean;      // Deflation phase indicator
    timestamp: Date;
}

// ECG data interfaces
export interface ECGData {
    waveform: number[];
    heartRate: number;
    timestamp: Date;
    rhythm: 'normal' | 'irregular' | 'bradycardia' | 'tachycardia' | 'afib';
    sampleRate?: number;
    mvPerCount?: number;
}

// Callback interfaces
export interface WellueSDKCallbacks {
    onDeviceFound?: (device: WellueDevice) => void;
    onDeviceConnected?: (device: WellueDevice) => void;
    onDeviceDisconnected?: (deviceId: string) => void;
    onBPMeasurement?: (measurement: BPMeasurement) => void;
    onBPProgress?: (progress: BPProgress) => void;
    onBPStatusChanged?: (status: BPStatus) => void;
    onRealTimeUpdate?: (data: RealTimeData) => void;
    onECGData?: (data: ECGData) => void;
    onECGLifecycle?: (state: 'start' | 'stop') => void;
    onBatteryUpdate?: (deviceId: string, battery: number) => void;
    onBluetoothStatusChanged?: (enabled: boolean) => void;
    onError?: (error: string, details?: any) => void;
}

// Native plugin interface
export interface WellueSDKPlugin {
    initialize(): Promise<any>;
    isBluetoothEnabled(): Promise<{ enabled: boolean }>;
    startScan(): Promise<any>;
    stopScan(): Promise<any>;
    connect(options: { address: string }): Promise<any>;
    disconnect(options?: { address?: string }): Promise<any>;
    getBatteryLevel(options: { address: string }): Promise<any>;
    getDeviceInfo?(): Promise<any>;
    startBPMeasurement?(): Promise<any>;
    startECGMeasurement?(): Promise<any>;
    startRtTaskForConnectedDevice?(): Promise<any>;
    stopMeasurement?(): Promise<any>;
    addListener(eventName: string, listenerFunc: (event: any) => void): any;
    removeAllListeners?(): Promise<any>;
    getBondedDevices?(): Promise<{ devices: Array<{ name: string; address: string }> }>;
    isDeviceConnected?(options: { address: string }): Promise<{ connected: boolean }>; 
    getConnectedDevices?(): Promise<{ devices: Array<{ name: string; address: string }> }>;
    getBp2FileList?(options: { address: string }): Promise<{ files: Array<{ fileName: string; fileType?: number }> }>;
    bp2ReadFile?(options: { address: string; fileName: string }): Promise<{ fileType?: number; fileContent?: string }>;
}

// Register the native plugin - Using Lepu SDK from official GitHub repository
// Plugin name must match CAP_PLUGIN registration in WellueSDKPlugin.m
const LepuSDK = registerPlugin<WellueSDKPlugin>('WellueSDK');

// BP Measurement Manager
class BPMeasurementManager {
    private isMeasuring = false;
    private currentPressure = 0;
    private status: BPStatus['status'] = 'idle';
    private lastMeasurement?: BPMeasurement;
    private error?: string;
    private callbacks: WellueSDKCallbacks;
    private deviceId?: string;
    private measurementStartTime?: number;
    private progressInterval?: NodeJS.Timeout;
    
    // 🚀 NEW: Enhanced BP measurement tracking
    private pressureHistory: Array<{pressure: number, timestamp: number}> = [];
    private inflationStartPressure = 0;
    private peakPressure = 0;
    private deflationStartPressure = 0;
    private measurementPhase: 'idle' | 'ready' | 'waiting' | 'inflating' | 'holding' | 'deflating' | 'analyzing' | 'complete' = 'idle';
    
    // 🚨 SAFETY: Pressure throttling and safety controls
    private lastDisplayedPressure = 0;
    private pressureThrottleDelay = 150; // 150ms delay between pressure updates
    private lastPressureUpdate = 0;
    private pressureUpdateQueue: Array<{pressure: number, timestamp: number}> = [];
    private isProcessingPressure = false;
    
    // 🚨 SAFETY: Pressure progression limits
    private maxPressureJump = 8; // Maximum pressure increase per update (mmHg)
    private minPressureJump = 2; // Minimum pressure increase per update (mmHg)
    private pressureStabilizationTime = 200; // Time to stabilize pressure (ms)

    // Pressure timeout detection (disabled - now handled natively via pressure stability)
    private lastPressureUpdateTime = 0;
    private lastRealPressureUpdate = 0; // Track when we last got actual BP pressure data
    
    constructor(callbacks: WellueSDKCallbacks) {
        this.callbacks = callbacks;
    }

    setDevice(deviceId: string) {
        this.deviceId = deviceId;
    }

    // 🚨 FIX: Add method to update callbacks without losing state
    setCallbacks(callbacks: Partial<WellueSDKCallbacks>) {
        // 🚨 CRITICAL FIX: MERGE callbacks instead of replacing them
        // Filter out undefined values to avoid overwriting existing callbacks with undefined
        const definedCallbacks = Object.fromEntries(
            Object.entries(callbacks).filter(([_, v]) => v !== undefined)
        ) as Partial<WellueSDKCallbacks>;
        
        this.callbacks = { ...this.callbacks, ...definedCallbacks };
        console.log('🔧 [BP MANAGER SET CALLBACKS] Merged callbacks. Current callbacks:', Object.keys(this.callbacks));
    }

    getStatus(): BPStatus {
        return {
            isMeasuring: this.isMeasuring,
            currentPressure: this.currentPressure,
            status: this.status,
            lastMeasurement: this.lastMeasurement,
            error: this.error
        };
    }

    startMeasurement() {
        // ✅ CRITICAL FIX: Don't reset if we're actively measuring (status 4) - prevents reset during deflation!
        // Only reset if we're truly in a 'complete' state AND not currently measuring
        if (this.status === 'complete' && !this.isMeasuring) {
            console.log('🔄 Resetting from previous complete measurement before starting new one');
            this.reset();
        }
        
        if (this.isMeasuring) {
            console.log('🩺 Measurement already in progress, continuing...');
            return;
        }
        
        console.log('🚀 BP Measurement Manager: Starting measurement');
        this.isMeasuring = true;
        this.status = 'starting';
        this.currentPressure = 0;
        // ✅ FIX 5: Keep lastMeasurement visible - only clear error
        // this.lastMeasurement = undefined; // ❌ DON'T CLEAR - keep visible until new measurement completes
        this.error = undefined;
        this.measurementStartTime = Date.now();
        
        // 🚀 NEW: Reset measurement tracking
        this.pressureHistory = [];
        this.inflationStartPressure = 0;
        this.peakPressure = 0;
        this.deflationStartPressure = 0;
        this.measurementPhase = 'waiting';
        
        // 🚨 SAFETY: Reset safety controls
        this.lastDisplayedPressure = 0;
        this.pressureUpdateQueue = [];
        this.isProcessingPressure = false;
        
        // 🚨 Reset pressure timeout tracking
        this.lastPressureUpdateTime = Date.now();
        this.lastRealPressureUpdate = Date.now(); // Initialize real pressure timestamp
        
        // 🚀 SIMPLIFIED: No artificial progress monitoring - let real pressure updates drive the display
        console.log('🚀 BP Measurement started - pressure bar will follow real device data');
        
        // ❌ DISABLED: Pressure timeout monitoring - was aborting measurements before status 5
        // The app MUST wait for native status 5 detection, not force a timeout
        // console.log('🚨 [START] About to call startPressureTimeoutMonitoring()');
        // this.startPressureTimeoutMonitoring();
        // console.log('🚨 [START] startPressureTimeoutMonitoring() called');
        console.log('✅ [START] Pressure timeout DISABLED - will wait for native status 5 detection');
        
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    updateProgress(pressure: number, status: BPProgress['status']) {
        const previousPressure = this.currentPressure;
        this.currentPressure = pressure;
        
        // 🚨 NEW: Reset pressure update timer on each update
        this.lastPressureUpdateTime = Date.now();

        // 🚨 NEW: Track pressure stability for completion detection
        if (pressure > 0 && (status === 'inflating' || status === 'deflating' || status === 'measuring')) {
            this.lastRealPressureUpdate = Date.now();
            // Pressure stability detection now handled natively in iOS for more accurate timing
        }
        
        // Only log significant pressure changes (every 20 mmHg)
        if (pressure % 20 === 0 && pressure > 0 && pressure !== previousPressure) {
            console.log(`🚨 [BP MANAGER] Pressure: ${pressure} mmHg (${status})`);
        }
        
        // ✅ CRITICAL FIX: Don't auto-start measurement from pressure updates!
        // Pressure updates can arrive DURING deflation of a new measurement while status is still 'complete'
        // Only native status 4 detection should trigger startMeasurement() to prevent premature resets
        // This prevents reset to 'ready' during deflation when pressure updates arrive
        
        // ❌ REMOVED: Auto-start on pressure > 0 - was causing resets during deflation
        // if (!this.isMeasuring && pressure > 0) {
        //     console.log('🚨 [START] Detected pressure > 0, calling startMeasurement()');
        //     this.startMeasurement();
        // }
        
        // 🚀 SIMPLIFIED: Update status based on pressure patterns (not complex phase detection)
        let actualStatus: BPProgress['status'] = 'measuring';
        
        if (this.isMeasuring) {
            if (pressure > previousPressure && pressure > 50) {
                actualStatus = 'inflating';
            } else if (pressure < previousPressure && pressure < 200) {
                actualStatus = 'deflating';
            } else if (pressure < 50 && pressure > 0) {
                actualStatus = 'analyzing';
            } else {
                actualStatus = 'measuring';
            }
        }
        
        this.status = actualStatus;

        // 🚀 SIMPLIFIED: Direct pressure update without queuing or smoothing
        const progress: BPProgress = {
            pressure: pressure, // Use actual pressure directly
            status: actualStatus,
            timestamp: new Date()
        };

        console.log(`📊 BP Progress: Pressure=${pressure} mmHg, Status=${actualStatus}, Phase=${this.measurementPhase}`);
        
        this.callbacks.onBPProgress?.(progress);
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    // 🚨 SAFETY: Queue pressure updates for safe, sequential display
    private queuePressureUpdate(pressure: number, status: BPProgress['status']) {
        const now = Date.now();
        
        // Add to queue with timestamp
        this.pressureUpdateQueue.push({
            pressure,
            timestamp: now
        });
        
        // Process queue if not already processing
        if (!this.isProcessingPressure) {
            this.processPressureQueue();
        }
    }

    // 🚨 SAFETY: Process pressure queue with throttling and safety limits
    private async processPressureQueue() {
        if (this.isProcessingPressure || this.pressureUpdateQueue.length === 0) {
            return;
        }

        this.isProcessingPressure = true;

        while (this.pressureUpdateQueue.length > 0) {
            const update = this.pressureUpdateQueue.shift();
            if (!update) continue;

            const now = Date.now();
            const timeSinceLastUpdate = now - this.lastPressureUpdate;

            // 🚨 SAFETY: Enforce throttling delay
            if (timeSinceLastUpdate < this.pressureThrottleDelay) {
                await this.delay(this.pressureThrottleDelay - timeSinceLastUpdate);
            }

            // 🚨 SAFETY: Apply pressure progression limits
            const safePressure = this.calculateSafePressure(update.pressure, this.status as BPProgress['status']);
            
            // Update displayed pressure safely
            this.lastDisplayedPressure = safePressure;
            this.lastPressureUpdate = now;

            // Emit safe pressure update with proper status
            if (this.callbacks.onBPProgress) {
                const currentStatus = this.determineActualStatus(update.pressure, 'measuring');
                this.callbacks.onBPProgress({
                    pressure: safePressure,
                    status: currentStatus,
                    timestamp: new Date()
                });
            }

            // Small delay between updates for smooth progression
            await this.delay(50);
        }

        this.isProcessingPressure = false;
    }

    // 🚨 SAFETY: Calculate safe pressure with progression limits
    private calculateSafePressure(targetPressure: number, status: BPProgress['status']): number {
        const currentDisplayed = this.lastDisplayedPressure;
        
        // If this is the first pressure reading, start safely
        if (currentDisplayed === 0) {
            // Start with a safe, low pressure
            return Math.min(targetPressure, 40);
        }

        // Calculate pressure difference
        const pressureDiff = targetPressure - currentDisplayed;
        
        // Apply safety limits based on measurement phase
        if (status === 'inflating') {
            // During inflation, limit pressure increase
            if (pressureDiff > 0) {
                const maxIncrease = Math.min(pressureDiff, this.maxPressureJump);
                const minIncrease = Math.max(maxIncrease, this.minPressureJump);
                return currentDisplayed + minIncrease;
            }
        } else if (status === 'deflating') {
            // During deflation, limit pressure decrease
            if (pressureDiff < 0) {
                const maxDecrease = Math.max(pressureDiff, -this.maxPressureJump);
                const minDecrease = Math.min(maxDecrease, -this.minPressureJump);
                return currentDisplayed + minDecrease;
            }
        }

        // For other states, allow normal progression
        return targetPressure;
    }

    // 🚨 SAFETY: Utility function for delays
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 🚀 NEW: Enhanced pressure tracking and phase detection
    private trackPressureAndDetectPhase(currentPressure: number, previousPressure: number) {
        const now = Date.now();
        
        // Add to pressure history
        this.pressureHistory.push({pressure: currentPressure, timestamp: now});
        
        // Keep only last 100 readings (10 seconds at 100ms intervals)
        if (this.pressureHistory.length > 100) {
            this.pressureHistory = this.pressureHistory.slice(-100);
        }
        
        // Detect measurement phases based on pressure patterns
        if (this.measurementPhase === 'waiting') {
            // Wait for inflation to start (pressure > 30 mmHg)
            if (currentPressure > 30) {
                console.log('🚀 Inflation detected starting at:', currentPressure, 'mmHg');
                this.measurementPhase = 'inflating';
                this.inflationStartPressure = currentPressure;
            }
        } else if (this.measurementPhase === 'inflating') {
            // Track peak pressure during inflation
            if (currentPressure > this.peakPressure) {
                this.peakPressure = currentPressure;
            }
            
            // Detect when inflation stops (pressure stabilizes or starts decreasing)
            if (currentPressure <= previousPressure || currentPressure <= this.peakPressure - 5) {
                console.log('📈 Inflation peak reached at:', this.peakPressure, 'mmHg, starting deflation');
                this.measurementPhase = 'deflating';
                this.deflationStartPressure = this.peakPressure;
            }
        } else if (this.measurementPhase === 'deflating') {
            // Monitor deflation progress
            if (currentPressure <= 65) {
                console.log('📉 Deflation complete, pressure at:', currentPressure, 'mmHg, starting analysis');
                this.measurementPhase = 'analyzing';
            }
        } else if (this.measurementPhase === 'analyzing') {
            // Wait for measurement completion
            if (currentPressure <= 0) {
                console.log('✅ Analysis complete, measurement finished');
                this.measurementPhase = 'complete';
            }
        }
    }

    // 🚀 NEW: Determine actual status based on measurement phase and pressure
    private determineActualStatus(pressure: number, inferredStatus: BPProgress['status']): BPProgress['status'] {
        // Use the detected phase instead of inferred status
        switch (this.measurementPhase) {
            case 'idle':
                return 'measuring'; // Use 'measuring' instead of 'idle' for progress
            case 'ready':
                return 'ready';
            case 'waiting':
                return 'measuring'; // Use 'measuring' instead of 'idle' for progress
            case 'inflating':
                return 'inflating';
            case 'deflating':
                return 'deflating';
            case 'analyzing':
                return 'analyzing';
            case 'complete':
                return 'analyzing'; // Use 'analyzing' instead of 'complete' for progress
            default:
                return inferredStatus;
        }
    }

    setMeasurement(measurement: BPMeasurement) {
        console.log('✅ BP Measurement Manager: Measurement completed:', measurement);
        this.lastMeasurement = measurement;
        this.status = 'complete';
        this.isMeasuring = false;
        this.currentPressure = 0;
        this.error = undefined;
        this.measurementPhase = 'complete';
        
        // 🚨 SAFETY: Reset safety controls
        this.lastDisplayedPressure = 0;
        this.pressureUpdateQueue = [];
        this.isProcessingPressure = false;
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }

        this.callbacks.onBPMeasurement?.(measurement);
        this.callbacks.onBPStatusChanged?.(this.getStatus());
        
        // ✅ FIX 2: NO auto-transition to ready - keep status as 'complete' so results stay visible
        // Status will only change when:
        // 1. User explicitly starts new measurement (handled in startMeasurement), OR
        // 2. Device status changes to 3 (handled in native Swift code)
        console.log('✅ Results displayed - status remains "complete" until next measurement starts');
    }

    setError(error: string, details?: any) {
        console.log('❌ BP Measurement Manager: Error occurred:', error, details);
        this.error = error;
        this.status = 'error';
        this.isMeasuring = false;
        this.currentPressure = 0;
        this.measurementPhase = 'idle';
        
        // 🚨 SAFETY: Reset safety controls
        this.lastDisplayedPressure = 0;
        this.pressureUpdateQueue = [];
        this.isProcessingPressure = false;
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }

        this.callbacks.onError?.(error, details);
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    reset() {
        console.log('🔄 BP Measurement Manager: Resetting to ready state');
        this.isMeasuring = false;
        this.status = 'ready';  // ✅ PRODUCTION FIX: Reset to 'ready', not 'idle'
        this.currentPressure = 0;
        this.error = undefined;
        this.measurementPhase = 'idle';
        // ✅ FIX 5: KEEP lastMeasurement so results remain visible after reset!
        // DO NOT clear lastMeasurement - it should persist even after reset
        
        // 🚨 NEW: Clear pressure timeout monitoring
        this.clearPressureStabilityMonitoring();
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
        
        // 🚨 SAFETY: Reset safety controls
        this.lastDisplayedPressure = 0;
        this.pressureUpdateQueue = [];
        this.isProcessingPressure = false;
        
        console.log('✅ [BP MANAGER] Reset complete, ready for next measurement');
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    completeMeasurement() {
        console.log('✅ BP Measurement Manager: Completing measurement');
        this.status = 'complete';
        this.isMeasuring = false;
        this.measurementPhase = 'complete';
        
        // 🚨 NEW: Clear pressure timeout monitoring
        this.clearPressureStabilityMonitoring();
        
        // 🚨 SAFETY: Reset safety controls
        this.lastDisplayedPressure = 0;
        this.pressureUpdateQueue = [];
        this.isProcessingPressure = false;
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
        
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    setReady() {
        console.log('🟢 BP Measurement Manager: Device ready');
        this.status = 'ready';
        this.isMeasuring = false;
        this.currentPressure = 0;
        this.error = undefined;
        this.measurementPhase = 'ready';
        
        // 🚨 NEW: Clear pressure timeout monitoring
        this.clearPressureStabilityMonitoring();
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
        
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

            // 🚨 NEW: Start pressure timeout monitoring for abrupt stop detection
    private startPressureStabilityMonitoring() {
        console.log('🚨 [TIMEOUT] Starting pressure timeout monitoring');
        console.log('🚨 [TIMEOUT] DEBUG: Method called successfully');
        
        // Clear any existing timeout interval
        if (this.pressureTimeoutInterval) {
            clearInterval(this.pressureTimeoutInterval);
            console.log('🚨 [TIMEOUT] Cleared existing timeout interval');
        }
        
        // Start monitoring for pressure updates
        this.pressureTimeoutInterval = setInterval(() => {
            console.log('🚨 [TIMEOUT] Interval callback triggered');
            
            if (!this.isMeasuring) {
                // Measurement already stopped, clear timeout
                console.log('🚨 [TIMEOUT] Measurement not active, clearing timeout');
                this.clearPressureStabilityMonitoring();
                return;
            }
            
            const now = Date.now();
            const timeSinceLastUpdate = now - this.lastRealPressureUpdate;
            
            console.log('🚨 [TIMEOUT] Checking BP pressure timeout:', {
                timeSinceLastUpdate,
                threshold: this.pressureTimeoutThreshold,
                isMeasuring: this.isMeasuring,
                currentPressure: this.currentPressure,
                lastRealPressureUpdate: this.lastRealPressureUpdate
            });
            
            // If no REAL BP pressure updates for threshold time, assume abrupt stop
            if (timeSinceLastUpdate > this.pressureTimeoutThreshold) {
                console.log('⏰ BP Pressure timeout detected - no BP updates for', this.pressureTimeoutThreshold, 'ms');
                this.handleAbruptStop();
            }
        }, 1000); // Check every second
        
        console.log('🚨 [TIMEOUT] Timeout monitoring interval set successfully');
    }
    
    // 🚨 NEW: Clear pressure timeout monitoring
    private clearPressureStabilityMonitoring() {
        if (this.pressureTimeoutInterval) {
            clearInterval(this.pressureTimeoutInterval);
            this.pressureTimeoutInterval = undefined;
        }
    }
    
    // 🚨 NEW: Handle abrupt stop detection
    private handleAbruptStop() {
        console.log('🛑 Abrupt BP measurement stop detected');
        
        // Clear timeout monitoring
        this.clearPressureStabilityMonitoring();
        
        // Reset measurement state
        this.isMeasuring = false;
        this.status = 'idle';
        this.currentPressure = 0;
        this.error = undefined; // Clear error for clean reset
        this.measurementPhase = 'idle';
        
        // Clear progress interval
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
        
        // Reset safety controls
        this.lastDisplayedPressure = 0;
        this.pressureUpdateQueue = [];
        this.isProcessingPressure = false;
        
        // Notify callbacks of abrupt stop
        this.callbacks.onBPStatusChanged?.(this.getStatus());
        
        console.log('🔄 BP Measurement Manager reset to idle state after abrupt stop');
    }

}

// Native Wellue Plugin Implementation
class NativeWelluePlugin {
    private callbacks: WellueSDKCallbacks = {};
    private isInitialized = false;
    private nativePlugin: WellueSDKPlugin;
    private connectedDevices: Map<string, WellueDevice> = new Map();
    private bpManager: BPMeasurementManager;
    private activeDeviceId?: string;
    private pluginAvailable: boolean = true;

    constructor() {
        console.log('🚀 [LEPU SDK PLUGIN] Constructor called');
        console.log('🚀 [LEPU SDK PLUGIN] LepuSDK plugin object:', LepuSDK);
        console.log('🚀 [LEPU SDK PLUGIN] LepuSDK type:', typeof LepuSDK);
        console.log('🚀 [LEPU SDK PLUGIN] Capacitor platform:', Capacitor.getPlatform());
        console.log('🚀 [LEPU SDK PLUGIN] Is native platform:', Capacitor.isNativePlatform());
        
        this.nativePlugin = LepuSDK;
        console.log('🚀 [NATIVE WELLUE PLUGIN] Native plugin assigned:', !!this.nativePlugin);
        
        // Enhanced diagnostic logging
        console.log('🔍 [DIAGNOSTIC] Plugin methods available:');
        const pluginKeys = Object.keys(this.nativePlugin || {});
        console.log('🔍 [DIAGNOSTIC] Plugin has', pluginKeys.length, 'properties/methods');
        console.log('🔍 [DIAGNOSTIC] Sample methods:', pluginKeys.slice(0, 10));
        
        // Detect plugin availability on this platform to avoid noisy errors
        try {
            const anyCap = Capacitor as any;
            const capSays = typeof anyCap.isPluginAvailable === 'function' ? anyCap.isPluginAvailable('WellueSDK') : undefined;
            const hasMethods = this.nativePlugin && typeof (this.nativePlugin as any).initialize === 'function';
            this.pluginAvailable = (capSays === true) || (!!hasMethods && Capacitor.isNativePlatform());
            
            console.log('🔍 [DIAGNOSTIC] Capacitor.isPluginAvailable result:', capSays);
            console.log('🔍 [DIAGNOSTIC] Has initialize method:', hasMethods);
            console.log('🚀 [NATIVE WELLUE PLUGIN] Plugin available check result:', this.pluginAvailable);
            
            if (!this.pluginAvailable) {
                console.error('❌ [PLUGIN NOT AVAILABLE] The WellueSDK plugin is not registered with Capacitor!');
                console.error('❌ This usually means:');
                console.error('❌ 1. The iOS app needs to be rebuilt in Xcode');
                console.error('❌ 2. Pod install failed or needs to be run');
                console.error('❌ 3. The plugin files are not compiled into the binary');
            }
        } catch (error) {
            console.log('⚠️ [NATIVE WELLUE PLUGIN] Plugin availability check failed, defaulting to true:', error);
            this.pluginAvailable = true;
        }
        
        console.log('🚀 [NATIVE WELLUE PLUGIN] Creating BP measurement manager...');
        this.bpManager = new BPMeasurementManager(this.callbacks);
        console.log('🚀 [NATIVE WELLUE PLUGIN] Setting up Bluetooth monitoring...');
        this.setupBluetoothMonitoring();
        console.log('✅ [NATIVE WELLUE PLUGIN] Constructor completed');
    }

    private setupBluetoothMonitoring() {
        console.log('🔵 [BLUETOOTH MONITORING] Setting up Bluetooth monitoring...');
        console.log('🔵 [BLUETOOTH MONITORING] Is native platform:', Capacitor.isNativePlatform());
        console.log('🔵 [BLUETOOTH MONITORING] Plugin available:', this.pluginAvailable);
        
        if (Capacitor.isNativePlatform()) {
            console.log('🔵 [BLUETOOTH MONITORING] Starting Bluetooth state monitoring...');
            this.monitorBluetoothState();
        } else {
            console.log('⚠️ [BLUETOOTH MONITORING] Skipping Bluetooth monitoring - not native platform or plugin not available');
        }
    }

    private async monitorBluetoothState() {
        console.log('🔵 [BLUETOOTH MONITORING] Starting Bluetooth state monitoring...');
        try {
            console.log('🔵 [BLUETOOTH MONITORING] Checking initial Bluetooth state...');
            const isEnabled = await this.checkBluetoothEnabled();
            console.log('🔵 [BLUETOOTH MONITORING] Initial Bluetooth state:', isEnabled);
            this.callbacks.onBluetoothStatusChanged?.(isEnabled);
            
            console.log('🔵 [BLUETOOTH MONITORING] Setting up periodic Bluetooth state checks...');
            setInterval(async () => {
                console.log('🔵 [BLUETOOTH MONITORING] Periodic Bluetooth state check...');
                const enabled = await this.checkBluetoothEnabled();
                console.log('🔵 [BLUETOOTH MONITORING] Periodic check result:', enabled);
                this.callbacks.onBluetoothStatusChanged?.(enabled);
            }, 5000);
            console.log('✅ [BLUETOOTH MONITORING] Bluetooth state monitoring set up successfully');
        } catch (error) {
            console.error('❌ [BLUETOOTH MONITORING] Failed to monitor Bluetooth state:', error);
        }
    }

    private async checkBluetoothEnabled(): Promise<boolean> {
        console.log('🔵 [BLUETOOTH CHECK] Starting Bluetooth status check...');
        console.log('🔵 [BLUETOOTH CHECK] Is native platform:', Capacitor.isNativePlatform());
        console.log('🔵 [BLUETOOTH CHECK] Plugin available:', this.pluginAvailable);
        
        if (!Capacitor.isNativePlatform()) {
            console.log('⚠️ [BLUETOOTH CHECK] Not on native platform');
            return false;
        }

        try {
            console.log('🔵 [BLUETOOTH CHECK] Calling native plugin isBluetoothEnabled()...');
            const result = await this.nativePlugin.isBluetoothEnabled();
            console.log('🔵 [BLUETOOTH CHECK] Native plugin result:', result);
            console.log('🔵 [BLUETOOTH CHECK] Bluetooth enabled:', result.enabled);
            return result.enabled;
        } catch (error) {
            // Suppress noisy unimplemented errors; report once
            const msg = String(error);
            console.log('❌ [BLUETOOTH CHECK] Error occurred:', error);
            console.log('❌ [BLUETOOTH CHECK] Error message:', msg);
            // Fallback to community BLE if available
            if (BleClient) {
                try {
                    console.log('🔵 [BLUETOOTH CHECK][FALLBACK] Initializing BleClient...');
                    if (typeof BleClient.initialize === 'function') {
                        await BleClient.initialize();
                    }
                    if (typeof BleClient.isEnabled === 'function') {
                        const enabled = await BleClient.isEnabled();
                        console.log('🔵 [BLUETOOTH CHECK][FALLBACK] isEnabled:', enabled);
                        return !!enabled;
                    }
                } catch (e) {
                    console.error('❌ [BLUETOOTH CHECK][FALLBACK] Failed:', e);
                }
            }
            if (!/not implemented/i.test(msg)) {
                console.error('❌ [BLUETOOTH CHECK] Error checking Bluetooth status:', error);
            }
            return false;
        }
    }

    setCallbacks(callbacks: WellueSDKCallbacks) {
        // 🚨 CRITICAL FIX: MERGE callbacks instead of replacing them
        this.callbacks = { ...this.callbacks, ...callbacks };
        console.log('🔧 [SET CALLBACKS] Merged callbacks. onRealTimeUpdate exists:', !!this.callbacks.onRealTimeUpdate);
        // 🚨 FIX: Don't create new BP manager, just update callbacks
        this.bpManager.setCallbacks(this.callbacks);
        if (this.activeDeviceId) {
            this.bpManager.setDevice(this.activeDeviceId);
        }
    }

    // 🚨 FIX: Add method to get current callbacks
    getCallbacks(): WellueSDKCallbacks {
        return this.callbacks;
    }

    async initialize(): Promise<void> {
        console.log('🚀 [LEPU SDK] Starting initialization...');
        console.log('🚀 [LEPU SDK] Is native platform:', Capacitor.isNativePlatform());
        console.log('🚀 [LEPU SDK] Plugin available:', this.pluginAvailable);
        console.log('🚀 [LEPU SDK] Native plugin exists:', !!this.nativePlugin);
        
        if (!Capacitor.isNativePlatform()) {
            console.warn('⚠️ [LEPU SDK] Not a native platform; skipping initialization');
            this.isInitialized = false;
            return;
        }

        try {
            console.log('🔵 [LEPU SDK] Calling native plugin initialize()...');
            await this.nativePlugin.initialize();
            console.log('✅ [LEPU SDK] Native plugin initialize() completed');
            
            console.log('🔵 [LEPU SDK] Setting up event listeners...');
            this.setupEventListeners();
            console.log('✅ [LEPU SDK] Event listeners set up');
            
            // Check initial Bluetooth status and notify
            console.log('🔵 [LEPU SDK] Checking initial Bluetooth status...');
            const bluetoothEnabled = await this.checkBluetoothEnabled();
            console.log('🔵 [LEPU SDK] Initial Bluetooth status check result:', bluetoothEnabled);
            this.callbacks.onBluetoothStatusChanged?.(bluetoothEnabled);

            this.isInitialized = true;
            console.log('✅ [LEPU SDK] Initialization completed successfully');
        } catch (error) {
            console.error('❌ [LEPU SDK] Failed to initialize:', error);
            throw error;
        }
    }

    private setupEventListeners() {
        console.log('🔵 [EVENT LISTENERS] Setting up event listeners...');
        console.log('🔵 [EVENT LISTENERS] Native plugin exists:', !!this.nativePlugin);
        
        if (!this.nativePlugin) {
            console.log('❌ [EVENT LISTENERS] No native plugin available, skipping event listener setup');
            return;
        }

        // Device found event
        console.log('🔵 [EVENT LISTENERS] Adding deviceFound listener...');
        this.nativePlugin.addListener('deviceFound', (data: any) => {
            console.log('🔍 [EVENT LISTENERS] Device found event received:', data);
            const device: WellueDevice = {
                id: data.deviceId,
                name: data.deviceName,
                model: data.model || 'BP2',
                rssi: data.rssi,
                isConnected: false,
                address: data.address
            };
            console.log('🔍 [EVENT LISTENERS] Processed device object:', device);
            this.callbacks.onDeviceFound?.(device);
        });

        // Device connected event
        this.nativePlugin.addListener('deviceConnected', (data: any) => {
            const device: WellueDevice = {
                id: data.deviceId || data.address,
                name: data.deviceName || data.name,
                model: data.model || 'BP2',
                battery: data.battery,
                isConnected: true,
                address: data.address || data.deviceId
            };
            this.connectedDevices.set(data.deviceId, device);
            this.activeDeviceId = data.deviceId;
            this.bpManager.setDevice(data.deviceId);
            
            // 🚀 CRITICAL: Start real-time data polling to detect device-initiated measurements
            console.log('🚀 [DEVICE CONNECTED] Starting RT task for device:', device.name);
            if (this.nativePlugin.startRtTaskForConnectedDevice) {
                this.nativePlugin.startRtTaskForConnectedDevice().catch((error: any) => {
                    console.error('❌ Failed to start RT task:', error);
                });
            }
            
            this.callbacks.onDeviceConnected?.(device);
        });

        // Device disconnected event
        this.nativePlugin.addListener('deviceDisconnected', (data: any) => {
            if (data?.deviceId) {
                this.connectedDevices.delete(data.deviceId);
                if (this.activeDeviceId === data.deviceId) {
                    this.activeDeviceId = undefined;
                    this.bpManager.reset();
                }
            }
            this.callbacks.onDeviceDisconnected?.(data?.deviceId || '');
        });

        // BP measurement event
        let lastMeasurementTimestamp = 0;
        this.nativePlugin.addListener('bpMeasurement', (data: any) => {
            console.log('🩺 BP Measurement result received:', data);
            
            // ✅ PRODUCTION FIX: Debounce duplicate measurements (device sends multiple times)
            const now = Date.now();
            if (now - lastMeasurementTimestamp < 2000) {
                console.log('⏭️  Skipping duplicate bpMeasurement (within 2s of last)');
                return;
            }
            lastMeasurementTimestamp = now;
            
            const measurement: BPMeasurement = {
                systolic: data.systolic,
                diastolic: data.diastolic,
                pulseRate: data.pulseRate || data.pulse,  // iOS sends 'pulse', Android sends 'pulseRate'
                timestamp: new Date(),
                quality: this.getQualityFromResult(data.result || data.state || data.stateCode),
                meanArterialPressure: data.map || data.mean  // ✅ FIX: Android sends 'map', iOS sends 'mean'
            };
            
            console.log('✅ Processed BP measurement:', measurement);
            this.bpManager.setMeasurement(measurement);
            
            // 🚨 FIX: Force status update to ensure UI receives the completion
            this.callbacks.onBPStatusChanged?.(this.bpManager.getStatus());
            
            // ✅ FIX 2: NO auto-reset - let user see results!
            // Auto-reset will happen only when:
            // 1. User explicitly starts new measurement, OR
            // 2. Device status changes to 3 (ready) after completion
            console.log('✅ Results displayed - NO auto-reset. User can see results indefinitely.');
        });

        // BP progress event (live pressure during measurement)
        this.nativePlugin.addListener('bpProgress', (data: any) => {
            console.log('🔴 LIVE BP Progress event received from NATIVE:', data);
            console.log('🔴 [NATIVE] BP Progress timestamp:', new Date().toISOString());
            
            if (typeof data?.pressure === 'number') {
                const pressure = data.pressure;
                
                console.log('🔴 [NATIVE] ===== PRESSURE FROM DEVICE =====');
                console.log('🔴 [NATIVE] Raw pressure value:', pressure, 'mmHg');
                console.log('🔴 [NATIVE] Device data object:', JSON.stringify(data));
                console.log('🔴 [NATIVE] Timestamp:', new Date().toISOString());
                
                // 🚀 NEW: Let BP manager handle status detection based on pressure patterns
                // Pass 'measuring' as initial status, manager will determine actual status
                this.bpManager.updateProgress(pressure, 'measuring');
                
                console.log('🔴 [NATIVE] ===== SENT TO BP MANAGER =====');
                console.log(`🔴 [NATIVE] Forwarded pressure: ${pressure} mmHg to BP manager`);
            } else {
                console.log('🔴 [NATIVE] ===== INVALID DATA =====');
                console.log('🔴 [NATIVE] Invalid BP progress data received:', JSON.stringify(data));
                console.log('🔴 [NATIVE] Data type check - pressure type:', typeof data?.pressure);
            }
        });

        // BP lifecycle event (device state changes)
        this.nativePlugin.addListener('bpLifecycle', (data: any) => {
            console.log('🩺 BP Lifecycle event received:', data);
            
            if (data?.state) {
                switch (data.state) {
                    case 'ready':
                        console.log('🩺 Device ready for measurement');
                        
                        // 🔒 GOD MODE: Check if measurement session is locked in React component
                        // We need to check the actual UI state, not just BP Manager state
                        // Since we can't directly access the React ref from here, we'll use a more aggressive check
                        const currentStatus = this.bpManager.getStatus();
                        
                        // ✅ CRITICAL FIX: Check BOTH isMeasuring flag AND status field
                        // During deflation, UI state is "measuring" - check status field to catch this
                        const isActivelyMeasuring = currentStatus.isMeasuring || 
                                                   currentStatus.status === 'measuring' || 
                                                   currentStatus.status === 'inflating' || 
                                                   currentStatus.status === 'deflating' ||
                                                   currentStatus.status === 'starting' ||
                                                   currentStatus.status === 'analyzing';
                        
                        // 🔒 GOD MODE: If actively measuring OR have results, COMPLETELY IGNORE ready event
                        // This prevents bpLifecycle("ready") from resetting UI during measurement
                        if (isActivelyMeasuring) {
                            console.log('🔒 [SESSION LOCK] ⛔ bpLifecycle("ready") BLOCKED - Measurement in progress!');
                            console.log('🔒 [SESSION LOCK] isMeasuring:', currentStatus.isMeasuring, 'status:', currentStatus.status);
                            console.log('🔒 [SESSION LOCK] IGNORING ready event to prevent UI reset during measurement');
                            return; // Exit early - measurement session is locked
                        }
                        
                        // ✅ CRITICAL FIX: NEVER reset from complete state to ready - preserve results indefinitely
                        // Check if we have lastMeasurement (indicates completion) instead of status === 'complete'
                        if (currentStatus.lastMeasurement || currentStatus.status === 'complete' || currentStatus.status === 'completed') {
                            console.log('🔒 [SESSION LOCK] ⛔ bpLifecycle("ready") BLOCKED - Results are visible!');
                            console.log('✅ Results are visible - ignoring ready event to preserve completion state');
                            return; // Exit early - don't process ready event when results are shown
                        }
                        
                        // Only set ready if truly idle/ready (no active measurement, no results)
                        if (!isActivelyMeasuring && !currentStatus.lastMeasurement && currentStatus.status !== 'complete' && currentStatus.status !== 'completed') {
                            console.log('✅ [READY] Setting ready state - no active measurement, no results');
                            this.bpManager.setReady();
                        } else {
                            console.log('🔒 [SESSION LOCK] ⛔ bpLifecycle("ready") BLOCKED - Conditions not met for ready state');
                        }
                        break;
                    case 'measuring':
                        // ✅ PRODUCTION FIX: Start measurement when lifecycle says measuring
                        const measuringStatus = this.bpManager.getStatus();
                        console.log('🔍 [LIFECYCLE MEASURING] Measurement lifecycle event - current status:', measuringStatus);
                        
                        // ✅ CRITICAL FIX: If we have previous results but status 4 arrived, it means a NEW measurement is starting
                        // Clear previous results to allow the new measurement to proceed
                        if (measuringStatus.lastMeasurement && !measuringStatus.isMeasuring) {
                            console.log('🔄 [NEW MEASUREMENT] Status 4 detected with previous results - clearing old results to start new measurement');
                            this.bpManager.reset(); // Clear previous measurement state
                        }
                        
                        if (!measuringStatus.isMeasuring) {
                            console.log('🩺 Device-initiated measurement detected, starting measurement');
                            this.bpManager.startMeasurement();
                        } else {
                            console.log('🩺 Measurement already in progress, continuing...');
                        }
                        break;
                    case 'complete':
                        console.log('🩺 Measurement lifecycle complete - waiting for bpMeasurement event with results');
                        // ✅ PRODUCTION FIX: Don't call completeMeasurement() here
                        // Let the bpMeasurement event handle completion with actual data
                        // Just ensure we're in the right state for receiving results
                        if (this.bpManager.getStatus().isMeasuring) {
                            console.log('🩺 Measurement still active, will complete when bpMeasurement arrives');
                        }
                        break;
                }
            }
        });

        // Native log forwarding for diagnostics
        this.nativePlugin.addListener('nativeLog', (data: any) => {
            const prefix = data.level === 'error' ? '❌ [NATIVE]' : data.level === 'warn' ? '⚠️ [NATIVE]' : '🔵 [NATIVE]';
            console.log(`${prefix} ${data.message}`);
        });

        // Real-time update event (reduced logging)
        let lastLoggedStatus: number | undefined;
        this.nativePlugin.addListener('bp2Rt', (data: any) => {
            // Map both iOS and Android field names
            const rtData: RealTimeData = {
                // Viatom SDK returns pressure in 0.1 mmHg units (e.g., 1250 = 125.0 mmHg)
                pressure: data?.pressure !== undefined ? Math.round(data.pressure / 10) : undefined,
                heartRate: data?.pulse || data?.hr,
                pulse: data?.pulse || data?.hr,
                progress: data?.percent,
                deviceStatus: data?.deviceStatus || data?.status,
                status: data?.status || data?.deviceStatus,
                batteryStatus: data?.batteryStatus || data?.batteryPercent,
                batteryPercent: data?.batteryPercent || data?.batteryStatus,
                isDeflating: data?.isDeflating,
                timestamp: new Date()
            };
            
            // Only log status changes
            if (rtData.deviceStatus !== lastLoggedStatus) {
                console.log(`📊 [BP2RT] Status: ${rtData.deviceStatus}, Battery: ${rtData.batteryPercent}%`);
                lastLoggedStatus = rtData.deviceStatus;
            }
            
            if (this.callbacks?.onRealTimeUpdate) {
                this.callbacks.onRealTimeUpdate(rtData);
            } else if (lastLoggedStatus === undefined) {
                console.warn('⚠️ [BP2RT] onRealTimeUpdate callback not set');
            }
        });

        // ECG data event
        this.nativePlugin.addListener('ecgData', (data: any) => {
            const ecgData: ECGData = {
                waveform: data.waveform || [],
                heartRate: data.heartRate,
                timestamp: new Date(),
                rhythm: this.getRhythmFromDiagnosis(data.diagnosis),
                sampleRate: data.sampleRate || 125,
                mvPerCount: data.mvPerCount || 1,
            };
            this.callbacks.onECGData?.(ecgData);
        });

        // ECG lifecycle events
        this.nativePlugin.addListener('ecgLifecycle', (data: any) => {
            const state = (data?.state === 'start' || data?.state === 'stop') ? data.state : undefined;
            if (state) this.callbacks.onECGLifecycle?.(state);
        });

        // Battery update event
        this.nativePlugin.addListener('batteryUpdate', (data: any) => {
            this.callbacks.onBatteryUpdate?.(data.deviceId, data.battery);
        });

        // Bluetooth status changed event
        console.log('🔵 [EVENT LISTENERS] Adding bluetoothStatusChanged listener...');
        this.nativePlugin.addListener('bluetoothStatusChanged', (data: any) => {
            console.log('🔵 [EVENT LISTENERS] Bluetooth status changed event received:', data);
            console.log('🔵 [EVENT LISTENERS] Bluetooth enabled:', data.enabled);
            this.callbacks.onBluetoothStatusChanged?.(data.enabled);
        });

        // Error event
        this.nativePlugin.addListener('error', (data: any) => {
            this.callbacks.onError?.(data.message || 'Unknown error', data);
        });
    }

    private getQualityFromResult(result: number): 'good' | 'fair' | 'poor' {
        switch (result) {
            case 0: return 'good';
            case 1:
            case 2: return 'fair';
            default: return 'poor';
        }
    }

    private getRhythmFromDiagnosis(diagnosis: unknown): 'normal' | 'irregular' | 'bradycardia' | 'tachycardia' | 'afib' {
        const text = typeof diagnosis === 'string' ? diagnosis : '';
        const hay = text.toLowerCase();
        if (hay.includes('regular') && !hay.includes('irregular')) return 'normal';
        if (hay.includes('irregular')) return 'irregular';
        if (hay.includes('slow') || hay.includes('brady')) return 'bradycardia';
        if (hay.includes('fast') || hay.includes('tachy')) return 'tachycardia';
        if (hay.includes('fibrillation') || hay.includes('afib') || hay.includes('a-fib')) return 'afib';
        return 'normal';
    }

    // 🚀 REMOVED: Old inferBPStatus method that was causing incorrect status inference
    // Now using enhanced phase detection in BPMeasurementManager

    async startScan(): Promise<void> {
        console.log('🔍 [START SCAN] Starting device scan...');
        console.log('🔍 [START SCAN] SDK initialized:', this.isInitialized);
        
        if (!this.isInitialized) {
            console.log('🔄 [START SCAN] SDK not initialized, auto-initializing now...');
            try {
                await this.initialize();
                console.log('✅ [START SCAN] Auto-initialize completed');
            } catch (e) {
                console.error('❌ [START SCAN] Auto-initialize failed:', e);
                throw new Error('Wellue SDK not initialized');
            }
        }

        console.log('🔍 [START SCAN] Checking Bluetooth status...');
        const bluetoothEnabled = await this.checkBluetoothEnabled();
        console.log('🔍 [START SCAN] Bluetooth enabled:', bluetoothEnabled);
        
        if (!bluetoothEnabled) {
            console.log('❌ [START SCAN] Bluetooth disabled, throwing error');
            throw new Error('Bluetooth is disabled. Please enable Bluetooth in device settings.');
        }

        try {
            console.log('🔍 [START SCAN] Calling native plugin startScan()...');
            await this.nativePlugin.startScan();
            console.log('✅ [START SCAN] Native plugin startScan() completed');
        } catch (error) {
            console.log('⚠️ [START SCAN] Native plugin failed, trying BLE fallback...');
            // Fallback to BLE scanning
            try {
                if (BleClient) {
                    await BleClient.initialize();
                    const devices = await BleClient.requestLEScan({
                        services: ['0000180D-0000-1000-8000-00805F9B34FB'], // Heart Rate service
                        allowDuplicates: false
                    });
                    console.log('🔍 [START SCAN][FALLBACK] BLE scan started, found devices:', devices);
                } else {
                    throw new Error('No BLE fallback available');
                }
            } catch (fallbackError) {
                console.error('❌ [START SCAN] Both native and BLE fallback failed:', fallbackError);
                throw error; // Throw original error
            }
        }
    }

    async stopScan(): Promise<void> {
        if (!this.isInitialized) {
            try { await this.initialize(); } catch {}
        }
        await this.nativePlugin.stopScan();
    }

    async connect(deviceId: string): Promise<WellueDevice> {
        if (!this.isInitialized) {
            try { await this.initialize(); } catch { throw new Error('Wellue SDK not initialized'); }
        }

        try {
            const deviceData = await this.nativePlugin.connect({ address: deviceId, deviceId: deviceId });
            
            const device: WellueDevice = {
                id: deviceId,
                name: deviceData.deviceName || deviceData.name || 'Device',
                model: deviceData.model || 'BP2',
                battery: deviceData.battery,
                isConnected: true,
                address: deviceData.address
            };
            
            this.connectedDevices.set(deviceId, device);
            this.activeDeviceId = deviceId;
            this.bpManager.setDevice(deviceId);
            return device;
            
        } catch (error) {
            console.error(`Failed to connect to device ${deviceId}:`, error);
            throw error;
        }
    }

    async disconnect(deviceId: string): Promise<void> {
        try {
            await this.nativePlugin.disconnect?.({ address: deviceId, deviceId: deviceId });
            this.connectedDevices.delete(deviceId);
            if (this.activeDeviceId === deviceId) {
                this.activeDeviceId = undefined;
                this.bpManager.reset();
            }
        } catch (error) {
            console.error(`Failed to disconnect from device ${deviceId}:`, error);
            throw error;
        }
    }

    async startBPMeasurement(deviceId: string): Promise<void> {
        console.error('🚨🚨🚨 WEB BRIDGE startBPMeasurement CALLED 🚨🚨🚨');
        console.error('🚨 deviceId:', deviceId);
        console.error('🚨 isInitialized:', this.isInitialized);
        console.error('🚨 nativePlugin exists:', !!this.nativePlugin);
        console.error('🚨 startBPMeasurement method exists:', !!this.nativePlugin.startBPMeasurement);
        
        if (!this.isInitialized) {
            console.error('❌ SDK not initialized');
            throw new Error('Wellue SDK not initialized');
        }

        const device = this.connectedDevices.get(deviceId);
        console.error('🚨 device found:', !!device);
        console.error('🚨 device connected:', device?.isConnected);
        
        if (!device || !device.isConnected) {
            console.error('❌ Device not connected');
            throw new Error('Device not connected');
        }

        try {
            console.error('🚨 About to call native startBPMeasurement...');
            
            // Reset BP manager state
            this.bpManager.reset();
            this.bpManager.setDevice(deviceId);
            
            // Start the measurement
            const result = await this.nativePlugin.startBPMeasurement?.();
            console.error('🚨 Native call completed, result:', result);
            
            console.log(`BP measurement started for device: ${deviceId}`);
        } catch (error) {
            console.error(`❌ Failed to start BP measurement for device ${deviceId}:`, error);
            this.bpManager.setError(`Failed to start BP measurement: ${error}`);
            throw error;
        }
    }

    async startECGMeasurement(deviceId: string): Promise<void> {
        if (!this.isInitialized) {
            try { await this.initialize(); } catch { throw new Error('Wellue SDK not initialized'); }
        }

        const device = this.connectedDevices.get(deviceId);
        if (!device || !device.isConnected) {
            throw new Error('Device not connected');
        }

        try {
            await this.nativePlugin.startECGMeasurement?.();
        } catch (error) {
            console.error(`Failed to start ECG measurement for device ${deviceId}:`, error);
            throw error;
        }
    }

    async startRtTaskForConnectedDevice(): Promise<void> {
        if (!this.isInitialized) {
            try { await this.initialize(); } catch { throw new Error('Wellue SDK not initialized'); }
        }
        try {
            await this.nativePlugin.startRtTaskForConnectedDevice?.();
        } catch (error) {
            console.error('Failed to start RT task for connected device:', error);
            throw error;
        }
    }

    async stopLive(deviceId: string): Promise<void> {
        try {
            await this.nativePlugin.stopMeasurement?.();
            this.bpManager.reset();
        } catch (error) {
            console.error('Failed to stop live measurement:', error);
            throw error;
        }
    }

    async getBatteryLevel(deviceId: string): Promise<number> {
        if (!this.isInitialized) {
            try { await this.initialize(); } catch { throw new Error('Wellue SDK not initialized'); }
        }

        const device = this.connectedDevices.get(deviceId);
        if (!device || !device.isConnected) {
            throw new Error('Device not connected');
        }

        try {
            const batteryLevel = await this.nativePlugin.getBatteryLevel?.({ address: deviceId, deviceId: deviceId });
            
            device.battery = batteryLevel;
            this.connectedDevices.set(deviceId, device);
            
            this.callbacks.onBatteryUpdate?.(deviceId, batteryLevel);
            return batteryLevel;
            
        } catch (error) {
            console.error(`Failed to get battery level for device ${deviceId}:`, error);
            throw error;
        }
    }

    async isConnected(deviceId: string): Promise<boolean> {
        try {
            const native = await this.nativePlugin.isDeviceConnected?.({ address: deviceId, deviceId: deviceId });
            if (native && typeof native.connected === 'boolean') return native.connected;
        } catch {}
        const device = this.connectedDevices.get(deviceId);
        return device?.isConnected || false;
    }

    async getConnectedDevices(): Promise<WellueDevice[]> {
        try {
            const res = await this.nativePlugin.getConnectedDevices?.();
            const fromNative = (res?.devices || []).map(d => ({
                id: d.address,
                name: d.name || 'Device',
                model: 'unknown',
                isConnected: true,
                address: d.address,
            } as WellueDevice));
            const map = new Map<string, WellueDevice>();
            for (const d of Array.from(this.connectedDevices.values())) map.set(d.id, d);
            for (const d of fromNative) map.set(d.id, d);
            return Array.from(map.values());
        } catch {
            return Array.from(this.connectedDevices.values());
        }
    }

    async getBondedDevices(): Promise<Array<{ name: string; address: string }>> {
        try {
            const result = await this.nativePlugin.getBondedDevices?.();
            return result?.devices || [];
        } catch (error) {
            console.error('Failed to get bonded devices:', error);
            return [];
        }
    }

    // Add methods for accessing stored files
    async getStoredFiles(deviceId: string): Promise<any[]> {
        try {
            console.log('🔍 NativeWelluePlugin: Attempting to get stored files for device:', deviceId);
            const result = await this.nativePlugin.getBp2FileList?.({ address: deviceId, deviceId: deviceId });
            console.log('📁 NativeWelluePlugin: Raw result from getBp2FileList:', result);
            return result?.files || [];
        } catch (error) {
            console.error('❌ NativeWelluePlugin: Failed to get stored files:', error);
            return [];
        }
    }

    async readStoredFile(deviceId: string, fileName: string): Promise<any> {
        try {
            console.log('📖 NativeWelluePlugin: Attempting to read stored file:', fileName, 'from device:', deviceId);
            const result = await this.nativePlugin.bp2ReadFile?.({ address: deviceId, deviceId: deviceId, fileName });
            console.log('📄 NativeWelluePlugin: Raw result from bp2ReadFile:', result);
            return result || {};
        } catch (error) {
            console.error('❌ NativeWelluePlugin: Failed to read stored file:', fileName, 'Error:', error);
            return {};
        }
    }

    getBPStatus(): BPStatus {
        return this.bpManager.getStatus();
    }

    // Force BP status update
    forceBPStatusUpdate() {
        this.callbacks.onBPStatusChanged?.(this.bpManager.getStatus());
    }

    // Force Bluetooth status check
    async forceBluetoothStatusCheck() {
        if (!this.isInitialized) {
            console.warn('SDK not initialized, cannot check Bluetooth status');
            return false;
        }
        
        try {
            const bluetoothEnabled = await this.checkBluetoothEnabled();
            console.log('🔵 Manual Bluetooth status check:', bluetoothEnabled);
            this.callbacks.onBluetoothStatusChanged?.(bluetoothEnabled);
            return bluetoothEnabled;
        } catch (error) {
            console.error('Failed to check Bluetooth status:', error);
            return false;
        }
    }
}

// Main SDK Bridge
export class WellueSDKBridge {
    private plugin: NativeWelluePlugin;
    private callbacks: WellueSDKCallbacks = {};
    private isInitialized = false;

    constructor() {
        console.log('🚀 [WELLUE SDK BRIDGE] Constructor called');
        console.log('🚀 [WELLUE SDK BRIDGE] Creating NativeWelluePlugin instance...');
        this.plugin = new NativeWelluePlugin();
        console.log('✅ [WELLUE SDK BRIDGE] Constructor completed');
    }

    async initialize(callbacks: WellueSDKCallbacks): Promise<void> {
        console.log('🚀 [WELLUE SDK BRIDGE] Initialize called');
        console.log('🔍 [WELLUE SDK BRIDGE] Already initialized:', this.isInitialized);
        
        // Update callbacks regardless of initialization state
        this.callbacks = callbacks;
        console.log('🚀 [WELLUE SDK BRIDGE] Setting callbacks on plugin...');
        this.plugin.setCallbacks(callbacks);
        
        // Only initialize native plugin once
        if (this.isInitialized) {
            console.log('✅ [WELLUE SDK BRIDGE] Already initialized - only updated callbacks');
            return;
        }
        
        console.log('🚀 [WELLUE SDK BRIDGE] First initialization - calling native plugin initialize...');
        await this.plugin.initialize();
        
        this.isInitialized = true;
        console.log('✅ [WELLUE SDK BRIDGE] Native initialization completed (will never re-initialize)');
    }

    async startScan(): Promise<void> {
        return this.plugin.startScan();
    }

    async stopScan(): Promise<void> {
        return this.plugin.stopScan();
    }

    async connect(deviceId: string): Promise<WellueDevice> {
        return this.plugin.connect(deviceId);
    }

    async disconnect(deviceId: string): Promise<void> {
        return this.plugin.disconnect(deviceId);
    }

    async startBPMeasurement(deviceId: string): Promise<void> {
        return this.plugin.startBPMeasurement(deviceId);
    }

    async startECGMeasurement(deviceId: string): Promise<void> {
        return this.plugin.startECGMeasurement(deviceId);
    }

    // Get battery level for a specific device
    async getBatteryLevel(deviceId: string): Promise<number> {
        try {
            return await this.plugin.getBatteryLevel(deviceId);
        } catch (error) {
            console.error('Failed to get battery level:', error);
            return 0;
        }
    }

    // Get stored files from device
    async getStoredFiles(deviceId: string): Promise<any[]> {
        try {
            console.log('🔍 WellueSDKBridge: Attempting to get stored files for device:', deviceId);
            
            // Use the new method from NativeWelluePlugin
            const result = await this.plugin.getStoredFiles(deviceId);
            console.log('📁 WellueSDKBridge: Result from getStoredFiles:', result);
            
            if (result && result.length > 0) {
                console.log('✅ WellueSDKBridge: Successfully retrieved stored files:', result.length, 'files');
                return result;
            } else {
                console.warn('⚠️ WellueSDKBridge: No files returned from getStoredFiles');
                return [];
            }
        } catch (error) {
            console.error('❌ WellueSDKBridge: Failed to get stored files:', error);
            return [];
        }
    }

    // Read a specific stored file from device
    async readStoredFile(deviceId: string, fileName: string): Promise<any> {
        try {
            console.log('📖 WellueSDKBridge: Attempting to read stored file:', fileName, 'from device:', deviceId);
            
            // Use the new method from NativeWelluePlugin
            const result = await this.plugin.readStoredFile(deviceId, fileName);
            console.log('📄 WellueSDKBridge: Result from readStoredFile:', result);
            
            if (result && Object.keys(result).length > 0) {
                console.log('✅ WellueSDKBridge: Successfully read stored file:', fileName);
                return result;
            } else {
                console.warn('⚠️ WellueSDKBridge: No result from readStoredFile for file:', fileName);
                return {};
            }
        } catch (error) {
            console.error('❌ WellueSDKBridge: Failed to read stored file:', fileName, 'Error:', error);
            return {};
        }
    }

    async isConnected(deviceId: string): Promise<boolean> {
        return this.plugin.isConnected(deviceId);
    }

    async getConnectedDevices(): Promise<WellueDevice[]> {
        return this.plugin.getConnectedDevices();
    }

    async getBondedDevices(): Promise<Array<{ name: string; address: string }>> {
        return this.plugin.getBondedDevices();
    }

    isNativePlatform(): boolean {
        return Capacitor.isNativePlatform();
    }

    getInitialized(): boolean {
        return this.isInitialized;
    }

    setCallbacks(callbacks: WellueSDKCallbacks) {
        // 🚨 CRITICAL FIX: MERGE callbacks instead of replacing them
        this.callbacks = { ...this.callbacks, ...callbacks };
        console.log('🔧 [BRIDGE SET CALLBACKS] Merged callbacks. onRealTimeUpdate exists:', !!this.callbacks.onRealTimeUpdate);
        this.plugin.setCallbacks(this.callbacks);
    }

    // 🚨 FIX: Add method to get current callbacks (for merging)
    getCallbacks(): WellueSDKCallbacks {
        return this.callbacks;
    }

    async stopLive(deviceId?: string): Promise<void> {
        return this.plugin.stopLive(deviceId || '');
    }

    async startRtTaskForConnectedDevice(): Promise<void> {
        console.log('🚀 [JS BRIDGE] startRtTaskForConnectedDevice() called');
        console.log('🚀 [JS BRIDGE] Current state:', {
            isInitialized: this.isInitialized,
            pluginExists: !!this.plugin,
            methodExists: !!this.plugin.startRtTaskForConnectedDevice
        });
        
        if (!this.isInitialized) {
            const error = new Error('SDK not initialized yet. Please wait for initialization to complete.');
            console.error('❌ [JS BRIDGE] startRtTaskForConnectedDevice failed:', error.message);
            throw error;
        }
        
        if (!this.plugin.startRtTaskForConnectedDevice) {
            const error = new Error('Native plugin method startRtTaskForConnectedDevice not available');
            console.error('❌ [JS BRIDGE] startRtTaskForConnectedDevice failed:', error.message);
            throw error;
        }
        
        // ✅ FIX 6: Retry logic with exponential backoff for SDK deployment
        const maxRetries = 4;
        let retryCount = 0;
        let delay = 1000; // Start with 1 second
        
        while (retryCount < maxRetries) {
            try {
                console.log(`🚀 [JS BRIDGE] Attempt ${retryCount + 1}/${maxRetries}: Calling native startRtTaskForConnectedDevice...`);
                const result = await this.plugin.startRtTaskForConnectedDevice();
                console.log('✅ [JS BRIDGE] startRtTaskForConnectedDevice() completed successfully:', result);
                return result;
            } catch (error: any) {
                retryCount++;
                const errorMessage = error?.message || String(error);
                
                // If SDK not ready, wait and retry
                if (errorMessage.includes('SDK not ready') || errorMessage.includes('deployment')) {
                    if (retryCount < maxRetries) {
                        console.log(`⏳ [JS BRIDGE] SDK not ready (attempt ${retryCount}/${maxRetries}), waiting ${delay}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2; // Exponential backoff: 1s, 2s, 4s, 8s
                        continue;
                    }
                }
                
                // For other errors or max retries reached, throw
                console.error(`❌ [JS BRIDGE] startRtTaskForConnectedDevice failed after ${retryCount} attempts:`, error);
                throw error;
            }
        }
    }

    // BP Status methods
    getBPStatus(): BPStatus {
        return this.plugin.getBPStatus();
    }

    // ✅ FIX 1: Add getBPMeasurementStatus() for health check
    getBPMeasurementStatus(): BPStatus {
        return this.bpManager.getStatus();
    }

    forceBPStatusUpdate() {
        this.plugin.forceBPStatusUpdate();
    }

    async forceBluetoothStatusCheck() {
        return this.plugin.forceBluetoothStatusCheck();
    }
}

// Export singleton instance
export const wellueSDK = new WellueSDKBridge();