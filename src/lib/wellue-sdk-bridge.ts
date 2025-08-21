import { Capacitor } from '@capacitor/core';
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
    heartRate?: number;
    progress?: number;
    deviceStatus?: number;
    batteryStatus?: number;
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

// Register the native plugin
const WellueSDK = registerPlugin<WellueSDKPlugin>('WellueSDK');

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

    // 🚨 NEW: Pressure timeout detection for abrupt stops
    private pressureTimeoutInterval?: NodeJS.Timeout;
    private lastPressureUpdateTime = 0;
    private pressureTimeoutThreshold = 2000; // 2 seconds without pressure updates = abrupt stop
    private lastRealPressureUpdate = 0; // Track when we last got actual BP pressure data
    
    constructor(callbacks: WellueSDKCallbacks) {
        this.callbacks = callbacks;
    }

    setDevice(deviceId: string) {
        this.deviceId = deviceId;
    }

    // 🚨 FIX: Add method to update callbacks without losing state
    setCallbacks(callbacks: WellueSDKCallbacks) {
        this.callbacks = callbacks;
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
        if (this.isMeasuring) return;
        
        console.log('🚀 BP Measurement Manager: Starting measurement');
        this.isMeasuring = true;
        this.status = 'starting';
        this.currentPressure = 0;
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
        
        // 🚨 NEW: Reset pressure timeout tracking
        this.lastPressureUpdateTime = Date.now();
        this.lastRealPressureUpdate = Date.now(); // Initialize real pressure timestamp
        
        // 🚀 SIMPLIFIED: No artificial progress monitoring - let real pressure updates drive the display
        console.log('🚀 BP Measurement started - pressure bar will follow real device data');
        
        // 🚨 NEW: Start pressure timeout monitoring
        console.log('🚨 [START] About to call startPressureTimeoutMonitoring()');
        this.startPressureTimeoutMonitoring();
        console.log('🚨 [START] startPressureTimeoutMonitoring() called');
        
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    updateProgress(pressure: number, status: BPProgress['status']) {
        const previousPressure = this.currentPressure;
        this.currentPressure = pressure;
        
        // 🚨 NEW: Reset pressure timeout timer on each update
        this.lastPressureUpdateTime = Date.now();
        
        // 🚨 NEW: Only update real pressure timestamp for actual BP pressure data (not other real-time updates)
        if (pressure > 0 && (status === 'inflating' || status === 'deflating' || status === 'measuring')) {
            this.lastRealPressureUpdate = Date.now();
            console.log('🚨 [PRESSURE] Real BP pressure update:', pressure, 'mmHg, updating timeout timer');
        }
        
        console.log('🚨 [BP MANAGER] ===== UPDATE PROGRESS =====');
        console.log('🚨 [BP MANAGER] Input pressure:', pressure, 'mmHg');
        console.log('🚨 [BP MANAGER] Input status:', status);
        console.log('🚨 [BP MANAGER] Previous pressure:', previousPressure, 'mmHg');
        console.log('🚨 [BP MANAGER] Pressure change:', pressure - previousPressure, 'mmHg');
        console.log('🚨 [BP MANAGER] Is measuring:', this.isMeasuring);
        console.log('🚨 [BP MANAGER] Timestamp:', new Date().toISOString());
        console.log('🚨 [BP MANAGER] Last real pressure update:', new Date(this.lastRealPressureUpdate).toISOString());
        
        // 🚀 SIMPLIFIED: Start measurement if not already started
        if (!this.isMeasuring && pressure > 0) {
            console.log('🚨 [START] Detected pressure > 0, calling startMeasurement()');
            this.startMeasurement();
        }
        
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
        console.log('🔄 BP Measurement Manager: Resetting');
        this.isMeasuring = false;
        this.status = 'idle';
        this.currentPressure = 0;
        this.error = undefined;
        this.measurementPhase = 'idle';
        
        // 🚨 NEW: Clear pressure timeout monitoring
        this.clearPressureTimeoutMonitoring();
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
        
        // 🚨 SAFETY: Reset safety controls
        this.lastDisplayedPressure = 0;
        this.pressureUpdateQueue = [];
        this.isProcessingPressure = false;
        
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    completeMeasurement() {
        console.log('✅ BP Measurement Manager: Completing measurement');
        this.status = 'complete';
        this.isMeasuring = false;
        this.measurementPhase = 'complete';
        
        // 🚨 NEW: Clear pressure timeout monitoring
        this.clearPressureTimeoutMonitoring();
        
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
        this.clearPressureTimeoutMonitoring();
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
        
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

            // 🚨 NEW: Start pressure timeout monitoring for abrupt stop detection
    private startPressureTimeoutMonitoring() {
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
                this.clearPressureTimeoutMonitoring();
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
    private clearPressureTimeoutMonitoring() {
        if (this.pressureTimeoutInterval) {
            clearInterval(this.pressureTimeoutInterval);
            this.pressureTimeoutInterval = undefined;
        }
    }
    
    // 🚨 NEW: Handle abrupt stop detection
    private handleAbruptStop() {
        console.log('🛑 Abrupt BP measurement stop detected');
        
        // Clear timeout monitoring
        this.clearPressureTimeoutMonitoring();
        
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

    constructor() {
        this.nativePlugin = WellueSDK;
        this.bpManager = new BPMeasurementManager(this.callbacks);
        this.setupBluetoothMonitoring();
    }

    private setupBluetoothMonitoring() {
        if (Capacitor.isNativePlatform()) {
            this.monitorBluetoothState();
        }
    }

    private async monitorBluetoothState() {
        try {
            const isEnabled = await this.checkBluetoothEnabled();
            this.callbacks.onBluetoothStatusChanged?.(isEnabled);
            setInterval(async () => {
                const enabled = await this.checkBluetoothEnabled();
                this.callbacks.onBluetoothStatusChanged?.(enabled);
            }, 5000);
        } catch (error) {
            console.error('Failed to monitor Bluetooth state:', error);
        }
    }

    private async checkBluetoothEnabled(): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) {
            return false;
        }

        try {
            const result = await this.nativePlugin.isBluetoothEnabled();
            return result.enabled;
        } catch (error) {
            console.error('Error checking Bluetooth status:', error);
            return false;
        }
    }

    setCallbacks(callbacks: WellueSDKCallbacks) {
        this.callbacks = callbacks;
        // 🚨 FIX: Don't create new BP manager, just update callbacks
        this.bpManager.setCallbacks(callbacks);
        if (this.activeDeviceId) {
            this.bpManager.setDevice(this.activeDeviceId);
        }
    }

    async initialize(): Promise<void> {
        if (!Capacitor.isNativePlatform()) {
            throw new Error('Native Wellue SDK only works on mobile devices');
        }

        try {
            await this.nativePlugin.initialize();
            this.setupEventListeners();
            const bluetoothEnabled = await this.checkBluetoothEnabled();
            this.callbacks.onBluetoothStatusChanged?.(bluetoothEnabled);

            this.isInitialized = true;
            console.log('Wellue SDK initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Wellue SDK:', error);
            throw error;
        }
    }

    private setupEventListeners() {
        if (!this.nativePlugin) return;

        // Device found event
        this.nativePlugin.addListener('deviceFound', (data: any) => {
            const device: WellueDevice = {
                id: data.deviceId,
                name: data.deviceName,
                model: data.model || 'BP2',
                rssi: data.rssi,
                isConnected: false,
                address: data.address
            };
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
        this.nativePlugin.addListener('bpMeasurement', (data: any) => {
            console.log('🩺 BP Measurement result received:', data);
            
            const measurement: BPMeasurement = {
                systolic: data.systolic,
                diastolic: data.diastolic,
                pulseRate: data.pulseRate,
                timestamp: new Date(),
                quality: this.getQualityFromResult(data.result),
                meanArterialPressure: data.map
            };
            
            console.log('✅ Processed BP measurement:', measurement);
            this.bpManager.setMeasurement(measurement);
            
            // 🚨 FIX: Force status update to ensure UI receives the completion
            this.callbacks.onBPStatusChanged?.(this.bpManager.getStatus());
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
                        this.bpManager.setReady();
                        break;
                    case 'measuring':
                        console.log('🩺 Measurement started on device');
                        // 🚨 FIX: Don't force start measurement, let pressure detection handle it
                        // This prevents interference with pressure-based phase detection
                        if (!this.bpManager.getStatus().isMeasuring) {
                            console.log('🩺 Device-initiated measurement detected, setting to waiting state');
                            this.bpManager.setReady(); // Reset to waiting state
                        }
                        break;
                    case 'complete':
                        console.log('🩺 Measurement completed');
                        this.bpManager.completeMeasurement();
                        break;
                }
            }
        });

        // Real-time update event
        this.nativePlugin.addListener('bp2Rt', (data: any) => {
            const rtData: RealTimeData = {
                heartRate: data?.hr,
                progress: data?.percent,
                deviceStatus: data?.deviceStatus,
                batteryStatus: data?.batteryStatus,
                timestamp: new Date()
            };
            this.callbacks.onRealTimeUpdate?.(rtData);
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
        if (!this.isInitialized) {
            throw new Error('Wellue SDK not initialized');
        }

        const bluetoothEnabled = await this.checkBluetoothEnabled();
        if (!bluetoothEnabled) {
            throw new Error('Bluetooth is disabled. Please enable Bluetooth in device settings.');
        }

        try {
            await this.nativePlugin.startScan();
        } catch (error) {
            console.error('Failed to start scan:', error);
            throw error;
        }
    }

    async stopScan(): Promise<void> {
        await this.nativePlugin.stopScan();
    }

    async connect(deviceId: string): Promise<WellueDevice> {
        if (!this.isInitialized) {
            throw new Error('Wellue SDK not initialized');
        }

        try {
            const deviceData = await this.nativePlugin.connect({ address: deviceId });
            
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
            await this.nativePlugin.disconnect?.({ address: deviceId });
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
            throw new Error('Wellue SDK not initialized');
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
            throw new Error('Wellue SDK not initialized');
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
            throw new Error('Wellue SDK not initialized');
        }

        const device = this.connectedDevices.get(deviceId);
        if (!device || !device.isConnected) {
            throw new Error('Device not connected');
        }

        try {
            const batteryLevel = await this.nativePlugin.getBatteryLevel?.({ address: deviceId });
            
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
            const native = await this.nativePlugin.isDeviceConnected?.({ address: deviceId });
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
            const result = await this.nativePlugin.getBp2FileList?.({ address: deviceId });
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
            const result = await this.nativePlugin.bp2ReadFile?.({ address: deviceId, fileName });
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
}

// Main SDK Bridge
export class WellueSDKBridge {
    private plugin: NativeWelluePlugin;
    private callbacks: WellueSDKCallbacks = {};
    private isInitialized = false;

    constructor() {
        this.plugin = new NativeWelluePlugin();
    }

    async initialize(callbacks: WellueSDKCallbacks): Promise<void> {
        this.callbacks = callbacks;
        this.plugin.setCallbacks(callbacks);
        await this.plugin.initialize();
        this.isInitialized = true;
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
        this.callbacks = callbacks;
        this.plugin.setCallbacks(callbacks);
    }

    async stopLive(deviceId?: string): Promise<void> {
        return this.plugin.stopLive(deviceId || '');
    }

    async startRtTaskForConnectedDevice(): Promise<void> {
        return this.plugin.startRtTaskForConnectedDevice();
    }

    // BP Status methods
    getBPStatus(): BPStatus {
        return this.plugin.getBPStatus();
    }

    forceBPStatusUpdate() {
        this.plugin.forceBPStatusUpdate();
    }
}

// Export singleton instance
export const wellueSDK = new WellueSDKBridge();