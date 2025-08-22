import { registerPlugin } from '@capacitor/core';

export interface Bp2RecordList {
    records: string[]; // filenames from device
}

export interface Bp2EcgResult {
    base64Int16?: string;      // if present: raw ADC data
    mvFloats?: number[];       // if present: already in mV
    sampleRate: number;        // 125 Hz
    scaleUvPerLsb?: number;    // 3.098 when base64Int16 is used
    durationSec?: number;
}

export interface Bp2Plugin {
    listEcgRecords(): Promise<Bp2RecordList>;
    getEcgRecord(options: { recordId: string }): Promise<Bp2EcgResult>;
}

export const Bp2 = registerPlugin<Bp2Plugin>('Bp2');

// Helper to decode base64 to Int16Array
export function base64ToInt16Array(b64: string): Int16Array {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Int16Array(bytes.buffer);
}

// Helper to convert Int16Array to mV values
export function int16ArrayToMv(int16Array: Int16Array, scaleUvPerLsb: number = 3.098): Float32Array {
    const mvPerLsb = scaleUvPerLsb / 1000; // Convert μV to mV
    const mv = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        mv[i] = int16Array[i] * mvPerLsb;
    }
    return mv;
}

// Main helper to get ECG data in mV format regardless of source
export function getEcgDataInMv(result: Bp2EcgResult): { samples: Float32Array; sampleRate: number } {
    if (result.base64Int16) {
        // Convert from Int16 ADC data
        const int16Array = base64ToInt16Array(result.base64Int16);
        const scale = result.scaleUvPerLsb || 3.098;
        const mv = int16ArrayToMv(int16Array, scale);
        return { samples: mv, sampleRate: result.sampleRate };
    } else if (result.mvFloats) {
        // Already in mV format
        return { samples: new Float32Array(result.mvFloats), sampleRate: result.sampleRate };
    } else {
        throw new Error("No ECG wave data returned");
    }
}
