const express = require('express');

const createLepuController = (deviceManager) => {
    const router = express.Router();

    // LepuDemo Device Models and Constants
    const LEPU_DEVICE_MODELS = {
        // Blood Pressure Monitors
        'BP2': { type: 'BP', name: 'BP2 Blood Pressure Monitor', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        'BP3': { type: 'BP', name: 'BP3 Blood Pressure Monitor', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        'AirBP': { type: 'BP', name: 'AirBP Blood Pressure Monitor', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        'BPM-188': { type: 'BP', name: 'BPM-188 Blood Pressure Monitor', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        
        // ECG Devices
        'ER1': { type: 'ECG', name: 'ER1 ECG Device', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        'ER2': { type: 'ECG', name: 'ER2 ECG Device', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        'ER3': { type: 'ECG', name: 'ER3 ECG Device', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        'PC-80B': { type: 'ECG', name: 'PC-80B ECG Device', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        'PC-300': { type: 'ECG', name: 'PC-300 ECG Device', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        
        // Pulse Oximeters
        'PC-60FW': { type: 'OXIMETER', name: 'PC-60FW Pulse Oximeter', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        'O2Ring': { type: 'OXIMETER', name: 'O2Ring Pulse Oximeter', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        'SP20': { type: 'OXIMETER', name: 'SP20 Pulse Oximeter', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        'PF-10AW': { type: 'OXIMETER', name: 'PF-10AW Pulse Oximeter', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        
        // Blood Glucose Meters
        'Bioland-BGM': { type: 'GLUCOSE', name: 'Bioland Blood Glucose Meter', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' },
        'LPM311': { type: 'GLUCOSE', name: 'LPM311 Blood Glucose Meter', serviceUUID: '0000FFE0-0000-1000-8000-00805F9B34FB' }
    };

    // Get all LepuDemo device models
    router.get('/models', (req, res) => {
        res.json({
            success: true,
            models: LEPU_DEVICE_MODELS,
            count: Object.keys(LEPU_DEVICE_MODELS).length
        });
    });

    // Register a LepuDemo device
    router.post('/devices/:deviceId/register', (req, res) => {
        const { deviceId } = req.params;
        const { model, macAddress, name, firmware, battery } = req.body;

        if (!LEPU_DEVICE_MODELS[model]) {
            return res.status(400).json({
                success: false,
                error: 'Unsupported LepuDemo device model'
            });
        }

        const deviceInfo = LEPU_DEVICE_MODELS[model];
        const device = {
            id: deviceId,
            name: name || deviceInfo.name,
            model: model,
            macAddress: macAddress,
            type: deviceInfo.type,
            serviceUUID: deviceInfo.serviceUUID,
            connected: true,
            battery: battery || 100,
            firmware: firmware || '1.0.0',
            manufacturer: 'LepuDemo',
            lastSeen: new Date(),
            capabilities: getDeviceCapabilities(model)
        };

        const registeredDevice = deviceManager.registerDevice(device, req.ip);
        
        res.json({
            success: true,
            message: 'LepuDemo device registered successfully',
            device: registeredDevice
        });
    });

    // Get LepuDemo device status
    router.get('/devices/:deviceId/status', (req, res) => {
        const { deviceId } = req.params;
        const device = deviceManager.getDevice(deviceId);

        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        res.json({
            success: true,
            device: device,
            status: {
                connected: device.connected,
                battery: device.battery,
                lastSeen: device.lastSeen,
                capabilities: device.capabilities
            }
        });
    });

    // Blood Pressure specific endpoints for LepuDemo
    router.post('/bp/:deviceId/measurement', (req, res) => {
        const { deviceId } = req.params;
        const { systolic, diastolic, mean, pulseRate, unit = 'mmHg', timestamp } = req.body;

        const measurement = {
            type: 'blood_pressure',
            systolic: parseInt(systolic),
            diastolic: parseInt(diastolic),
            mean: parseInt(mean) || Math.floor((systolic + 2 * diastolic) / 3),
            pulseRate: parseInt(pulseRate),
            unit: unit,
            timestamp: timestamp || new Date().toISOString(),
            source: 'LepuDemo',
            deviceModel: 'BP2' // Default, can be overridden
        };

        const storedMeasurement = deviceManager.storeMeasurement(deviceId, measurement);
        
        res.json({
            success: true,
            message: 'Blood pressure measurement stored',
            measurement: storedMeasurement
        });
    });

    // ECG specific endpoints for LepuDemo
    router.post('/ecg/:deviceId/data', (req, res) => {
        const { deviceId } = req.params;
        const { heartRate, waveformData, samplingRate = 125, duration, leadOff = false } = req.body;

        const measurement = {
            type: 'ecg',
            heartRate: parseInt(heartRate),
            waveformData: Array.isArray(waveformData) ? waveformData : [],
            samplingRate: parseInt(samplingRate),
            duration: parseInt(duration),
            leadOff: Boolean(leadOff),
            timestamp: new Date().toISOString(),
            source: 'LepuDemo',
            deviceModel: 'PC-80B' // Default, can be overridden
        };

        const storedMeasurement = deviceManager.storeMeasurement(deviceId, measurement);
        
        res.json({
            success: true,
            message: 'ECG data stored',
            measurement: storedMeasurement
        });
    });

    // Pulse Oximeter specific endpoints for LepuDemo
    router.post('/oximeter/:deviceId/measurement', (req, res) => {
        const { deviceId } = req.params;
        const { spo2, pulseRate, pi, probeOff = false, pulseSearching = false } = req.body;

        const measurement = {
            type: 'oximeter',
            spo2: parseInt(spo2),
            pulseRate: parseInt(pulseRate),
            pi: parseFloat(pi),
            probeOff: Boolean(probeOff),
            pulseSearching: Boolean(pulseSearching),
            timestamp: new Date().toISOString(),
            source: 'LepuDemo',
            deviceModel: 'PC-60FW' // Default, can be overridden
        };

        const storedMeasurement = deviceManager.storeMeasurement(deviceId, measurement);
        
        res.json({
            success: true,
            message: 'Pulse oximeter measurement stored',
            measurement: storedMeasurement
        });
    });

    // Blood Glucose specific endpoints for LepuDemo
    router.post('/glucose/:deviceId/measurement', (req, res) => {
        const { deviceId } = req.params;
        const { value, unit = 'mg/dL', result, testType = 'random' } = req.body;

        const measurement = {
            type: 'glucose',
            value: parseFloat(value),
            unit: unit,
            result: result || getGlucoseResult(value, unit),
            testType: testType,
            timestamp: new Date().toISOString(),
            source: 'LepuDemo',
            deviceModel: 'Bioland-BGM' // Default, can be overridden
        };

        const storedMeasurement = deviceManager.storeMeasurement(deviceId, measurement);
        
        res.json({
            success: true,
            message: 'Glucose measurement stored',
            measurement: storedMeasurement
        });
    });

    // Get LepuDemo device history
    router.get('/devices/:deviceId/history', (req, res) => {
        const { deviceId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const type = req.query.type; // Optional filter by measurement type

        const measurements = deviceManager.getDeviceMeasurements(deviceId, limit);
        const filteredMeasurements = type 
            ? measurements.filter(m => m.type === type)
            : measurements;

        res.json({
            success: true,
            deviceId: deviceId,
            measurements: filteredMeasurements,
            count: filteredMeasurements.length,
            total: measurements.length
        });
    });

    // LepuDemo device configuration
    router.get('/devices/:deviceId/config', (req, res) => {
        const { deviceId } = req.params;
        const device = deviceManager.getDevice(deviceId);

        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        const config = getDeviceConfiguration(device.model);
        
        res.json({
            success: true,
            deviceId: deviceId,
            config: config
        });
    });

    // Update LepuDemo device configuration
    router.post('/devices/:deviceId/config', (req, res) => {
        const { deviceId } = req.params;
        const configData = req.body;
        const device = deviceManager.getDevice(deviceId);

        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // Update device configuration
        device.config = { ...device.config, ...configData };
        
        res.json({
            success: true,
            message: 'Device configuration updated',
            deviceId: deviceId,
            config: device.config
        });
    });

    // Helper functions
    function getDeviceCapabilities(model) {
        const capabilities = {
            'BP2': ['blood_pressure', 'pulse_rate'],
            'BP3': ['blood_pressure', 'pulse_rate', 'irregular_heartbeat'],
            'AirBP': ['blood_pressure', 'pulse_rate', 'mean_pressure'],
            'BPM-188': ['blood_pressure', 'pulse_rate', 'mean_pressure'],
            'ER1': ['ecg', 'heart_rate', 'rhythm_analysis'],
            'ER2': ['ecg', 'heart_rate', 'rhythm_analysis', 'st_segment'],
            'ER3': ['ecg', 'heart_rate', 'rhythm_analysis', 'st_segment', 'qt_interval'],
            'PC-80B': ['ecg', 'heart_rate', 'rhythm_analysis'],
            'PC-300': ['ecg', 'heart_rate', 'rhythm_analysis', 'st_segment'],
            'PC-60FW': ['spo2', 'pulse_rate', 'pi'],
            'O2Ring': ['spo2', 'pulse_rate', 'pi', 'continuous_monitoring'],
            'SP20': ['spo2', 'pulse_rate', 'pi'],
            'PF-10AW': ['spo2', 'pulse_rate', 'pi', 'alarm'],
            'Bioland-BGM': ['glucose', 'trend_analysis'],
            'LPM311': ['glucose', 'trend_analysis', 'data_export']
        };

        return capabilities[model] || [];
    }

    function getDeviceConfiguration(model) {
        const configs = {
            'BP2': {
                measurementMode: 'auto',
                unit: 'mmHg',
                alarmEnabled: true,
                alarmThresholds: {
                    systolicHigh: 140,
                    systolicLow: 90,
                    diastolicHigh: 90,
                    diastolicLow: 60
                }
            },
            'PC-80B': {
                recordingDuration: 30,
                samplingRate: 125,
                leadConfiguration: '3-lead',
                filterEnabled: true
            },
            'PC-60FW': {
                alarmEnabled: true,
                alarmThresholds: {
                    spo2Low: 90,
                    pulseRateHigh: 100,
                    pulseRateLow: 60
                },
                averagingTime: 8
            },
            'Bioland-BGM': {
                unit: 'mg/dL',
                alarmEnabled: true,
                alarmThresholds: {
                    high: 140,
                    low: 70
                }
            }
        };

        return configs[model] || {};
    }

    function getGlucoseResult(value, unit) {
        if (unit === 'mg/dL') {
            if (value < 70) return 'Low';
            if (value < 140) return 'Normal';
            if (value < 200) return 'High';
            return 'Very High';
        } else if (unit === 'mmol/L') {
            if (value < 3.9) return 'Low';
            if (value < 7.8) return 'Normal';
            if (value < 11.1) return 'High';
            return 'Very High';
        }
        return 'Unknown';
    }

    return router;
};

module.exports = createLepuController; 