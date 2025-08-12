declare module '@capacitor/core' {
  interface PluginRegistry {
    WellueSDK: WellueSDKPlugin;
  }
}

export interface WellueSDKPlugin {
  initialize(): Promise<{ success: boolean; message?: string }>;
  isBluetoothEnabled(): Promise<{ enabled: boolean }>;
  startScan(): Promise<{ success: boolean; message?: string }>;
  stopScan(): Promise<{ success: boolean; message?: string }>;
  connect(options: { address: string }): Promise<{ success: boolean; message?: string; address?: string; deviceName?: string }>;
  disconnect(options?: { address?: string }): Promise<{ success: boolean; message?: string }>;
  startBPMeasurement?(): Promise<{ success: boolean; message?: string }>;
  startECGMeasurement?(): Promise<{ success: boolean; message?: string }>;
  stopMeasurement?(): Promise<{ success: boolean; message?: string }>;
  getBatteryLevel?(options?: { address?: string }): Promise<number>;
  getDeviceInfo?(): Promise<any>;
  addListener(eventName: string, listenerFunc: (data: any) => void): any;
  removeAllListeners?(): void;
}

export interface WellueDevice {
  id: string;
  name: string;
  model: string;
  rssi?: number;
  battery?: number;
  isConnected?: boolean;
}

export interface BPMeasurement {
  systolic: number;
  diastolic: number;
  mean: number;
  pulseRate: number;
  result: number;
  timestamp: number;
}

export interface ECGData {
  heartRate: number;
  qrs: number;
  pvcs: number;
  qtc: number;
  diagnosis: string;
  waveform: number[];
  sampleRate: number;
  timestamp: number;
  mvPerCount?: number;
}

export interface RealTimeData {
  hr?: number;
  deviceStatus?: number;
  batteryStatus?: number;
  batteryPercent?: number;
  [key: string]: any;
}

export interface DeviceInfo {
  batteryLevel: number;
  firmwareVersion: string;
  serialNumber: string;
}

export interface RTData {
  type: string;
  dataType: string;
  deviceStatus: number;
  batteryStatus: number;
  batteryPercent: number;
  [key: string]: any;
}
