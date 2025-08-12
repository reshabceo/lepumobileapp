// Wellue BP2 Protocol Parser
// Based on Viatom SDK and reverse-engineered protocol

export interface BP2Data {
    type: 'bp_measurement' | 'ecg_data' | 'heart_rate' | 'device_info' | 'battery_status' | 'error';
    timestamp: number;
    data: any;
}

export interface BP2Measurement {
    systolic: number;
    diastolic: number;
    mean: number;
    pulseRate: number;
    irregularHeartbeat: boolean;
    unit: string;
    quality: 'good' | 'fair' | 'poor';
    error?: string;
}

export interface ECGData {
    heartRate: number;
    waveformData: number[];
    samplingRate: number;
    duration: number;
    leadOff: boolean;
    rhythm: 'normal' | 'irregular' | 'bradycardia' | 'tachycardia' | 'afib';
    quality: 'good' | 'fair' | 'poor';
}

export interface DeviceInfo {
    model: string;
    firmware: string;
    battery: number;
    isCharging: boolean;
    signalStrength: number;
    connected: boolean;
}

export class WellueBP2Protocol {
    private static readonly SERVICE_UUID = '0000ff00-0000-1000-8000-00805f9b34fb';
    private static readonly CHARACTERISTIC_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';
    
    // Command codes for BP2 device
    private static readonly COMMANDS = {
        START_BP: 0x01,
        START_ECG: 0x02,
        START_HEART_RATE: 0x03,
        STOP_MEASUREMENT: 0x04,
        GET_DEVICE_INFO: 0x05,
        GET_BATTERY: 0x06,
        GET_FIRMWARE: 0x07
    };

    // Data packet types
    private static readonly PACKET_TYPES = {
        BP_MEASURING: 0x00,
        BP_COMPLETE: 0x01,
        ECG_DATA: 0x02,
        HEART_RATE: 0x03,
        DEVICE_INFO: 0x04,
        BATTERY_STATUS: 0x05,
        ERROR: 0xFF
    };

    /**
     * Parse incoming data from BP2 device
     */
    static parseData(buffer: ArrayBuffer): BP2Data | null {
        try {
            const dataView = new DataView(buffer);
            const bytes = new Uint8Array(buffer);
            
            if (bytes.length < 2) {
                console.warn('BP2: Invalid packet length');
                return null;
            }

            const packetType = bytes[0];
            const dataLength = bytes[1];

            if (bytes.length < dataLength + 2) {
                console.warn('BP2: Packet length mismatch');
                return null;
            }

            switch (packetType) {
                case this.PACKET_TYPES.BP_MEASURING:
                    return this.parseBPMeasuring(bytes.slice(2, dataLength + 2));
                case this.PACKET_TYPES.BP_COMPLETE:
                    return this.parseBPComplete(bytes.slice(2, dataLength + 2));
                case this.PACKET_TYPES.ECG_DATA:
                    return this.parseECGData(bytes.slice(2, dataLength + 2));
                case this.PACKET_TYPES.HEART_RATE:
                    return this.parseHeartRate(bytes.slice(2, dataLength + 2));
                case this.PACKET_TYPES.DEVICE_INFO:
                    return this.parseDeviceInfo(bytes.slice(2, dataLength + 2));
                case this.PACKET_TYPES.BATTERY_STATUS:
                    return this.parseBatteryStatus(bytes.slice(2, dataLength + 2));
                case this.PACKET_TYPES.ERROR:
                    return this.parseError(bytes.slice(2, dataLength + 2));
                default:
                    console.warn(`BP2: Unknown packet type: ${packetType}`);
                    return null;
            }
        } catch (error) {
            console.error('BP2: Error parsing data:', error);
            return null;
        }
    }

    /**
     * Parse real-time BP measuring data
     */
    private static parseBPMeasuring(bytes: Uint8Array): BP2Data {
        if (bytes.length < 6) {
            throw new Error('Invalid BP measuring data length');
        }

        const pressure = (bytes[0] << 8) | bytes[1]; // 16-bit pressure value
        const pulseRate = (bytes[2] << 8) | bytes[3]; // 16-bit pulse rate
        const flags = bytes[4];
        const isDeflate = !!(flags & 0x01);
        const isPulse = !!(flags & 0x02);
        const quality = bytes[5];

        return {
            type: 'bp_measurement',
            timestamp: Date.now(),
            data: {
                pressure,
                pulseRate,
                isDeflate,
                isPulse,
                quality: this.getQualityLevel(quality),
                phase: isDeflate ? 'deflating' : 'inflating'
            }
        };
    }

    /**
     * Parse complete BP measurement result
     */
    private static parseBPComplete(bytes: Uint8Array): BP2Data {
        if (bytes.length < 8) {
            throw new Error('Invalid BP complete data length');
        }

        const systolic = (bytes[0] << 8) | bytes[1];
        const diastolic = (bytes[2] << 8) | bytes[3];
        const mean = (bytes[4] << 8) | bytes[5];
        const pulseRate = (bytes[6] << 8) | bytes[7];
        const flags = bytes.length > 8 ? bytes[8] : 0;
        const irregularHeartbeat = !!(flags & 0x01);

        // Validate BP values
        if (systolic < 60 || systolic > 300 || diastolic < 40 || diastolic > 200) {
            throw new Error('Invalid BP values received');
        }

        const measurement: BP2Measurement = {
            systolic,
            diastolic,
            mean,
            pulseRate,
            irregularHeartbeat,
            unit: 'mmHg',
            quality: this.calculateBPQuality(systolic, diastolic, pulseRate)
        };

        return {
            type: 'bp_measurement',
            timestamp: Date.now(),
            data: measurement
        };
    }

    /**
     * Parse ECG data
     */
    private static parseECGData(bytes: Uint8Array): BP2Data {
        if (bytes.length < 8) {
            throw new Error('Invalid ECG data length');
        }

        const heartRate = (bytes[0] << 8) | bytes[1];
        const samplingRate = (bytes[2] << 8) | bytes[3];
        const duration = (bytes[4] << 8) | bytes[5];
        const flags = bytes[6];
        const leadOff = !!(flags & 0x01);
        const rhythmType = bytes[7];

        // Parse waveform data (remaining bytes)
        const waveformData: number[] = [];
        for (let i = 8; i < bytes.length; i += 2) {
            if (i + 1 < bytes.length) {
                const sample = ((bytes[i] << 8) | bytes[i + 1]) - 32768; // Convert to signed 16-bit
                waveformData.push(sample);
            }
        }

        const ecgData: ECGData = {
            heartRate,
            waveformData,
            samplingRate,
            duration,
            leadOff,
            rhythm: this.getRhythmType(rhythmType),
            quality: this.calculateECGQuality(waveformData, heartRate)
        };

        return {
            type: 'ecg_data',
            timestamp: Date.now(),
            data: ecgData
        };
    }

    /**
     * Parse heart rate data
     */
    private static parseHeartRate(bytes: Uint8Array): BP2Data {
        if (bytes.length < 4) {
            throw new Error('Invalid heart rate data length');
        }

        const heartRate = (bytes[0] << 8) | bytes[1];
        const quality = bytes[2];
        const flags = bytes[3];

        return {
            type: 'heart_rate',
            timestamp: Date.now(),
            data: {
                heartRate,
                quality: this.getQualityLevel(quality),
                irregular: !!(flags & 0x01),
                signalStrength: flags & 0x0F
            }
        };
    }

    /**
     * Parse device information
     */
    private static parseDeviceInfo(bytes: Uint8Array): BP2Data {
        if (bytes.length < 6) {
            throw new Error('Invalid device info length');
        }

        const model = String.fromCharCode(...bytes.slice(0, 4)).trim();
        const firmware = `${bytes[4]}.${bytes[5]}`;
        const battery = bytes.length > 6 ? bytes[6] : 0;
        const isCharging = bytes.length > 7 ? !!(bytes[7] & 0x01) : false;

        const deviceInfo: DeviceInfo = {
            model,
            firmware,
            battery,
            isCharging,
            signalStrength: 100, // Will be updated separately
            connected: true
        };

        return {
            type: 'device_info',
            timestamp: Date.now(),
            data: deviceInfo
        };
    }

    /**
     * Parse battery status
     */
    private static parseBatteryStatus(bytes: Uint8Array): BP2Data {
        if (bytes.length < 2) {
            throw new Error('Invalid battery status length');
        }

        const battery = bytes[0];
        const isCharging = !!(bytes[1] & 0x01);

        return {
            type: 'battery_status',
            timestamp: Date.now(),
            data: {
                battery,
                isCharging
            }
        };
    }

    /**
     * Parse error message
     */
    private static parseError(bytes: Uint8Array): BP2Data {
        const errorCode = bytes[0];
        const errorMessage = this.getErrorMessage(errorCode);

        return {
            type: 'error',
            timestamp: Date.now(),
            data: {
                code: errorCode,
                message: errorMessage
            }
        };
    }

    /**
     * Generate command to send to device
     */
    static generateCommand(command: number, data?: Uint8Array): Uint8Array {
        const header = new Uint8Array([command]);
        if (data) {
            const result = new Uint8Array(header.length + data.length);
            result.set(header);
            result.set(data, header.length);
            return result;
        }
        return header;
    }

    /**
     * Get quality level from quality byte
     */
    private static getQualityLevel(quality: number): 'good' | 'fair' | 'poor' {
        if (quality >= 80) return 'good';
        if (quality >= 60) return 'fair';
        return 'poor';
    }

    /**
     * Calculate BP measurement quality
     */
    private static calculateBPQuality(systolic: number, diastolic: number, pulseRate: number): 'good' | 'fair' | 'poor' {
        // Simple quality calculation based on value ranges
        const systolicNormal = systolic >= 90 && systolic <= 140;
        const diastolicNormal = diastolic >= 60 && diastolic <= 90;
        const pulseNormal = pulseRate >= 60 && pulseRate <= 100;

        const normalCount = [systolicNormal, diastolicNormal, pulseNormal].filter(Boolean).length;
        
        if (normalCount >= 2) return 'good';
        if (normalCount >= 1) return 'fair';
        return 'poor';
    }

    /**
     * Calculate ECG quality based on waveform data
     */
    private static calculateECGQuality(waveformData: number[], heartRate: number): 'good' | 'fair' | 'poor' {
        if (waveformData.length === 0) return 'poor';

        // Calculate signal variance as a simple quality indicator
        const mean = waveformData.reduce((sum, val) => sum + val, 0) / waveformData.length;
        const variance = waveformData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / waveformData.length;
        
        // Higher variance indicates better signal quality
        if (variance > 1000) return 'good';
        if (variance > 500) return 'fair';
        return 'poor';
    }

    /**
     * Get rhythm type from rhythm byte
     */
    private static getRhythmType(rhythm: number): 'normal' | 'irregular' | 'bradycardia' | 'tachycardia' | 'afib' {
        switch (rhythm) {
            case 0: return 'normal';
            case 1: return 'irregular';
            case 2: return 'bradycardia';
            case 3: return 'tachycardia';
            case 4: return 'afib';
            default: return 'normal';
        }
    }

    /**
     * Get error message from error code
     */
    private static getErrorMessage(errorCode: number): string {
        const errorMessages: { [key: number]: string } = {
            0x01: 'Cuff error - Check cuff placement',
            0x02: 'No pulse detected',
            0x03: 'Over pressure - Release cuff',
            0x04: 'Weak signal - Check sensor placement',
            0x05: 'Device error - Restart device',
            0x06: 'Low battery',
            0x07: 'Connection lost',
            0x08: 'Measurement timeout',
            0x09: 'Invalid measurement',
            0x0A: 'Device busy'
        };

        return errorMessages[errorCode] || `Unknown error (${errorCode})`;
    }

    /**
     * Validate BP measurement values
     */
    static validateBPMeasurement(measurement: BP2Measurement): boolean {
        return (
            measurement.systolic >= 60 && measurement.systolic <= 300 &&
            measurement.diastolic >= 40 && measurement.diastolic <= 200 &&
            measurement.pulseRate >= 40 && measurement.pulseRate <= 200 &&
            measurement.mean >= 40 && measurement.mean <= 200
        );
    }

    /**
     * Get device service and characteristic UUIDs
     */
    static getServiceUUIDs() {
        return {
            service: this.SERVICE_UUID,
            characteristic: this.CHARACTERISTIC_UUID
        };
    }

    /**
     * Get command codes
     */
    static getCommands() {
        return this.COMMANDS;
    }
}
