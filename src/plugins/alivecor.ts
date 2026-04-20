import { registerPlugin } from '@capacitor/core';

export interface AliveCorInitOptions {
  jwt: string;
  isDebugMode?: boolean;
}

export interface AliveCorRecordOptions {
  leadConfig?: 'single' | 'six';
  durationSeconds?: number;
  mainsFilter?: 50 | 60;
}

export interface AliveCorEcgResult {
  mvData: number[];
  /** When native returns per-lead mV (optional); overrides flat mvData for upload */
  waveformLeads?: Record<string, (number | null)[]>;
  sampleRate: number;
  durationSeconds: number;
  heartRate: number;
  determination: string;
  modifier: string;
  algorithmPackage: string;
  leadConfig: string;
  deviceType: string;
  isInverted: boolean;
  qualityScore: number;
  rawResponse?: string;
}

export interface AliveCorDeviceInfo {
  connected: boolean;
  deviceName?: string;
  deviceType?: string;
  firmwareVersion?: string;
}

export interface AliveCorPlugin {
  initialize(options: AliveCorInitOptions): Promise<void>;
  startRecording(options?: AliveCorRecordOptions): Promise<AliveCorEcgResult>;
  getDeviceStatus(): Promise<AliveCorDeviceInfo>;
  dispose(): Promise<void>;
}

export const AliveCor = registerPlugin<AliveCorPlugin>('AliveCor');

/** Map SDK determination strings to human-readable clinical labels (KAI v2). */
export const DETERMINATION_LABELS: Record<string, string> = {
  SINUS_RHYTHM: 'Normal Sinus Rhythm',
  SINUS_RHYTHM_WITH_WIDE_QRS: 'Sinus Rhythm with Wide QRS',
  SINUS_RHYTHM_WITH_PVCS: 'Sinus Rhythm with PVCs',
  SINUS_RHYTHM_WITH_SVE: 'Sinus Rhythm with SVE',
  AFIB: 'Possible Atrial Fibrillation',
  BRADYCARDIA: 'Bradycardia',
  TACHYCARDIA: 'Tachycardia',
  UNCLASSIFIED: 'Unclassified',
  UNREADABLE: 'Unreadable',
  SHORT: 'Too Short',
  NO_ANALYSIS: 'No Analysis',
  NORMAL: 'Normal',
};
