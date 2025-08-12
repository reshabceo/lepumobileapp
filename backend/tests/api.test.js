const request = require('supertest');
const { app } = require('../src/app');

describe('Medical Device API Tests', () => {

    describe('Health Check', () => {
        test('GET /api/health should return server status', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'ok');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('devices');
            expect(response.body).toHaveProperty('lepuDemo');
        });
    });

    describe('Device Management API', () => {
        test('GET /api/devices should return device list', async () => {
            const response = await request(app)
                .get('/api/devices')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('devices');
            expect(Array.isArray(response.body.devices)).toBe(true);
        });

        test('POST /api/devices/test-device/connect should connect device', async () => {
            const deviceData = {
                name: 'Test Device',
                model: 'TestModel',
                macAddress: 'AA:BB:CC:DD:EE:FF',
                type: 'BP'
            };

            const response = await request(app)
                .post('/api/devices/test-device/connect')
                .send(deviceData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('device');
        });
    });

    describe('Blood Pressure API', () => {
        test('POST /api/bp/invalid-device/start-measurement should return 404', async () => {
            await request(app)
                .post('/api/bp/invalid-device/start-measurement')
                .expect(404);
        });

        test('GET /api/bp/invalid-device/real-time should return 404', async () => {
            await request(app)
                .get('/api/bp/invalid-device/real-time')
                .expect(404);
        });
    });

    describe('ECG API', () => {
        test('POST /api/ecg/invalid-device/start-recording should return 404', async () => {
            await request(app)
                .post('/api/ecg/invalid-device/start-recording')
                .expect(404);
        });

        test('GET /api/ecg/invalid-device/files should return 404', async () => {
            await request(app)
                .get('/api/ecg/invalid-device/files')
                .expect(404);
        });
    });

    describe('Pulse Oximeter API', () => {
        test('GET /api/oximeter/invalid-device/real-time should return 404', async () => {
            await request(app)
                .get('/api/oximeter/invalid-device/real-time')
                .expect(404);
        });

        test('GET /api/oximeter/invalid-device/waveform should return 404', async () => {
            await request(app)
                .get('/api/oximeter/invalid-device/waveform')
                .expect(404);
        });
    });

    describe('Glucose Meter API', () => {
        test('POST /api/glucose/invalid-device/measure should return 404', async () => {
            await request(app)
                .post('/api/glucose/invalid-device/measure')
                .expect(404);
        });

        test('GET /api/glucose/invalid-device/latest should return 404', async () => {
            await request(app)
                .get('/api/glucose/invalid-device/latest')
                .expect(404);
        });
    });

    describe('LepuDemo API', () => {
        test('GET /api/lepu/models should return supported models', async () => {
            const response = await request(app)
                .get('/api/lepu/models')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('models');
            expect(response.body).toHaveProperty('count');
            expect(response.body.count).toBeGreaterThan(0);
            expect(response.body.models).toHaveProperty('BP2');
            expect(response.body.models).toHaveProperty('PC-80B');
            expect(response.body.models).toHaveProperty('PC-60FW');
        });

        test('POST /api/lepu/devices/test-device/register should register a device', async () => {
            const deviceData = {
                model: 'BP2',
                macAddress: 'AA:BB:CC:DD:EE:FF',
                name: 'Test BP Monitor',
                firmware: '1.0.0',
                battery: 85
            };

            const response = await request(app)
                .post('/api/lepu/devices/test-device/register')
                .send(deviceData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('device');
            expect(response.body.device).toHaveProperty('id', 'test-device');
            expect(response.body.device).toHaveProperty('model', 'BP2');
            expect(response.body.device).toHaveProperty('manufacturer', 'LepuDemo');
        });

        test('POST /api/lepu/devices/invalid-model/register should return 400 for unsupported model', async () => {
            const deviceData = {
                model: 'INVALID_MODEL',
                macAddress: 'AA:BB:CC:DD:EE:FF'
            };

            const response = await request(app)
                .post('/api/lepu/devices/invalid-device/register')
                .send(deviceData)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });

        test('GET /api/lepu/devices/test-device/status should return device status', async () => {
            // First register a device
            const deviceData = {
                model: 'PC-80B',
                macAddress: 'AA:BB:CC:DD:EE:FF',
                name: 'Test ECG Device'
            };

            await request(app)
                .post('/api/lepu/devices/test-ecg-device/register')
                .send(deviceData);

            const response = await request(app)
                .get('/api/lepu/devices/test-ecg-device/status')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('device');
            expect(response.body).toHaveProperty('status');
            expect(response.body.device).toHaveProperty('model', 'PC-80B');
        });

        test('POST /api/lepu/bp/test-device/measurement should store BP measurement', async () => {
            const measurementData = {
                systolic: 120,
                diastolic: 80,
                mean: 93,
                pulseRate: 72,
                unit: 'mmHg'
            };

            const response = await request(app)
                .post('/api/lepu/bp/test-device/measurement')
                .send(measurementData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('measurement');
            expect(response.body.measurement).toHaveProperty('systolic', 120);
            expect(response.body.measurement).toHaveProperty('diastolic', 80);
            expect(response.body.measurement).toHaveProperty('source', 'LepuDemo');
        });

        test('POST /api/lepu/ecg/test-device/data should store ECG data', async () => {
            const ecgData = {
                heartRate: 75,
                waveformData: [120, 121, 119, 122, 120],
                samplingRate: 125,
                duration: 30,
                leadOff: false
            };

            const response = await request(app)
                .post('/api/lepu/ecg/test-device/data')
                .send(ecgData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('measurement');
            expect(response.body.measurement).toHaveProperty('heartRate', 75);
            expect(response.body.measurement).toHaveProperty('source', 'LepuDemo');
        });

        test('POST /api/lepu/oximeter/test-device/measurement should store oximeter measurement', async () => {
            const oximeterData = {
                spo2: 98,
                pulseRate: 72,
                pi: 2.1,
                probeOff: false
            };

            const response = await request(app)
                .post('/api/lepu/oximeter/test-device/measurement')
                .send(oximeterData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('measurement');
            expect(response.body.measurement).toHaveProperty('spo2', 98);
            expect(response.body.measurement).toHaveProperty('source', 'LepuDemo');
        });

        test('POST /api/lepu/glucose/test-device/measurement should store glucose measurement', async () => {
            const glucoseData = {
                value: 110,
                unit: 'mg/dL',
                testType: 'fasting'
            };

            const response = await request(app)
                .post('/api/lepu/glucose/test-device/measurement')
                .send(glucoseData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('measurement');
            expect(response.body.measurement).toHaveProperty('value', 110);
            expect(response.body.measurement).toHaveProperty('source', 'LepuDemo');
        });

        test('GET /api/lepu/devices/test-device/history should return device history', async () => {
            const response = await request(app)
                .get('/api/lepu/devices/test-device/history')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('deviceId', 'test-device');
            expect(response.body).toHaveProperty('measurements');
            expect(response.body).toHaveProperty('count');
            expect(response.body).toHaveProperty('total');
        });
    });
});

// Integration tests with mock devices
describe('Integration Tests with Mock Devices', () => {
    test('Complete BP measurement workflow', async () => {
        // This test would simulate a complete blood pressure measurement
        // 1. Connect device
        // 2. Start measurement
        // 3. Receive real-time data
        // 4. Get final results
        // 5. Disconnect device

        // Note: This requires actual device implementation or comprehensive mocking
        expect(true).toBe(true); // Placeholder
    });

    test('Complete ECG recording workflow', async () => {
        // This test would simulate a complete ECG recording
        // 1. Connect device
        // 2. Start recording
        // 3. Receive real-time ECG data
        // 4. Stop recording
        // 5. Download ECG file

        expect(true).toBe(true); // Placeholder
    });
});