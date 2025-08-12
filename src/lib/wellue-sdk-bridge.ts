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
    status: 'inflating' | 'holding' | 'deflating' | 'analyzing' | 'measuring';
    timestamp: Date;
}

export interface BPStatus {
    isMeasuring: boolean;
    currentPressure: number;
    status: 'idle' | 'starting' | 'inflating' | 'holding' | 'deflating' | 'analyzing' | 'measuring' | 'complete' | 'error';
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

    constructor(callbacks: WellueSDKCallbacks) {
        this.callbacks = callbacks;
    }

    setDevice(deviceId: string) {
        this.deviceId = deviceId;
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
        
        this.isMeasuring = true;
        this.status = 'starting';
        this.currentPressure = 0;
        this.error = undefined;
        this.measurementStartTime = Date.now();
        
        // Start progress monitoring
        this.progressInterval = setInterval(() => {
            if (this.isMeasuring && (this.status === 'inflating' || this.status === 'holding' || this.status === 'deflating' || this.status === 'analyzing')) {
                // Emit progress update
                this.callbacks.onBPProgress?.({
                    pressure: this.currentPressure,
                    status: this.status as BPProgress['status'],
                    timestamp: new Date()
                });
            }
        }, 100); // Update every 100ms during measurement
        
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    updateProgress(pressure: number, status: BPProgress['status']) {
        this.currentPressure = pressure;
        this.status = status;
        
        if ((status === 'inflating' || status === 'holding' || status === 'deflating' || status === 'analyzing') && !this.isMeasuring) {
            this.startMeasurement();
        }

        const progress: BPProgress = {
            pressure,
            status,
            timestamp: new Date()
        };

        this.callbacks.onBPProgress?.(progress);
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    setMeasurement(measurement: BPMeasurement) {
        this.lastMeasurement = measurement;
        this.status = 'complete';
        this.isMeasuring = false;
        this.currentPressure = 0;
        this.error = undefined;
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }

        this.callbacks.onBPMeasurement?.(measurement);
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    setError(error: string, details?: any) {
        this.error = error;
        this.status = 'error';
        this.isMeasuring = false;
        this.currentPressure = 0;
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }

        this.callbacks.onError?.(error, details);
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    reset() {
        this.isMeasuring = false;
        this.currentPressure = 0;
        this.status = 'idle';
        this.error = undefined;
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
        
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }

    // Handle device-initiated measurement start
    handleDeviceInitiatedStart() {
        if (!this.isMeasuring) {
            this.startMeasurement();
        }
    }
    
    setReady() {
        if (this.isMeasuring) return; // Don't override active measurement
        
        this.status = 'idle';
        this.error = undefined;
        this.currentPressure = 0;
        this.callbacks.onBPStatusChanged?.(this.getStatus());
    }
    
    completeMeasurement() {
        if (!this.isMeasuring) return;
        
        this.isMeasuring = false;
        // Don't set status to 'complete' here - wait for actual measurement data
        // The setMeasurement method will set it to 'complete' when data arrives
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
        
        this.callbacks.onBPStatusChanged?.(this.getStatus());
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
        this.bpManager = new BPMeasurementManager(callbacks);
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
            const measurement: BPMeasurement = {
                systolic: data.systolic,
                diastolic: data.diastolic,
                pulseRate: data.pulseRate,
                timestamp: new Date(),
                quality: this.getQualityFromResult(data.result),
                meanArterialPressure: data.map
            };
            this.bpManager.setMeasurement(measurement);
        });

        // BP progress event (live pressure during measurement)
        this.nativePlugin.addListener('bpProgress', (data: any) => {
            console.log('🔴 LIVE BP Progress event received:', data);
            
            if (typeof data?.pressure === 'number') {
                const pressure = data.pressure;
                const status = this.inferBPStatus(pressure);
                
                console.log(`🔴 Live pressure: ${pressure} mmHg, status: ${status}`);
                
                // Update BP manager with live pressure
                this.bpManager.updateProgress(pressure, status);
                
                // Force UI update with live pressure data
                if (this.callbacks.onBPProgress) {
                    this.callbacks.onBPProgress({
                        pressure: pressure,
                        status: status,
                        timestamp: new Date()
                    });
                }
            } else {
                console.log('🔴 Invalid BP progress data:', data);
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
                        this.bpManager.startMeasurement();
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

    private inferBPStatus(pressure: number): BPProgress['status'] {
        // Simple logic to infer BP status based on pressure changes
        // This can be enhanced with more sophisticated logic
        if (pressure > 200) return 'inflating';
        if (pressure > 50) return 'deflating';
        return 'analyzing';
    }

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