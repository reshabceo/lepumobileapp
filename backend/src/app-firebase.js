// Medical Device Backend API - Firebase Connected
// Node.js backend with Firebase database instead of in-memory storage

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

// 🔥 Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin with your service account
try {
    // Using service account key file
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'lepuapp'
    });

    console.log('🔥 Firebase Admin initialized successfully for project: lepuapp');
} catch (error) {
    console.error('❌ Firebase initialization failed. Using in-memory fallback:', error.message);
    console.log('📋 To fix: Check firebase-service-account.json file exists and is valid');
}

const db = admin.firestore();
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// In-memory fallback (if Firebase not available)
const fallbackDevices = new Map();
const fallbackMeasurements = new Map();
const connectedClients = new Set();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// 🔥 Firebase Device Manager
class FirebaseDeviceManager {
    constructor() {
        this.useFirebase = admin.apps.length > 0;
        console.log(`📊 Using ${this.useFirebase ? 'Firebase' : 'in-memory'} storage`);
    }

    // Register device from mobile app
    async registerDevice(deviceData, clientId) {
        const device = {
            id: deviceData.id || uuidv4(),
            name: deviceData.name,
            model: deviceData.model,
            macAddress: deviceData.macAddress,
            type: deviceData.type, // 'BP', 'ECG', 'OXIMETER', 'GLUCOSE'
            connected: true,
            clientId: clientId,
            lastSeen: admin.firestore.Timestamp.now(),
            battery: deviceData.battery || null,
            firmware: deviceData.firmware || null,
            createdAt: admin.firestore.Timestamp.now()
        };

        try {
            if (this.useFirebase) {
                // 🔥 Save to Firebase
                await db.collection('devices').doc(device.id).set(device);
                console.log(`🔥 Device ${device.id} saved to Firebase`);
            } else {
                // Fallback to in-memory
                fallbackDevices.set(device.id, device);
                console.log(`💾 Device ${device.id} saved to memory (fallback)`);
            }

            // Notify all clients about new device
            io.emit('device_discovered', device);
            io.emit('device_connected', { deviceId: device.id });

            return device;
        } catch (error) {
            console.error('❌ Failed to register device:', error);
            throw error;
        }
    }

    // Store measurement data from mobile app
    async storeMeasurement(deviceId, measurementData) {
        const measurement = {
            id: uuidv4(),
            deviceId: deviceId,
            timestamp: admin.firestore.Timestamp.now(),
            ...measurementData
        };

        try {
            if (this.useFirebase) {
                // 🔥 Save to Firebase
                await db.collection('measurements').doc(measurement.id).set(measurement);

                // Also add to device-specific subcollection for easier querying
                await db.collection('devices')
                    .doc(deviceId)
                    .collection('measurements')
                    .doc(measurement.id)
                    .set(measurement);

                console.log(`🔥 Measurement ${measurement.id} saved to Firebase`);
            } else {
                // Fallback to in-memory
                if (!fallbackMeasurements.has(deviceId)) {
                    fallbackMeasurements.set(deviceId, []);
                }
                fallbackMeasurements.get(deviceId).push(measurement);
                console.log(`💾 Measurement ${measurement.id} saved to memory (fallback)`);
            }

            // Emit real-time data based on device type
            this.emitRealTimeData(deviceId, measurementData);

            return measurement;
        } catch (error) {
            console.error('❌ Failed to store measurement:', error);
            throw error;
        }
    }

    // Get all devices
    async getAllDevices() {
        try {
            if (this.useFirebase) {
                const snapshot = await db.collection('devices').get();
                const devices = [];
                snapshot.forEach(doc => {
                    devices.push({ id: doc.id, ...doc.data() });
                });
                return devices;
            } else {
                return Array.from(fallbackDevices.values());
            }
        } catch (error) {
            console.error('❌ Failed to get devices:', error);
            return [];
        }
    }

    // Get device measurements
    async getDeviceMeasurements(deviceId, limit = 50) {
        try {
            if (this.useFirebase) {
                const snapshot = await db.collection('devices')
                    .doc(deviceId)
                    .collection('measurements')
                    .orderBy('timestamp', 'desc')
                    .limit(limit)
                    .get();

                const measurements = [];
                snapshot.forEach(doc => {
                    measurements.push({ id: doc.id, ...doc.data() });
                });
                return measurements;
            } else {
                return fallbackMeasurements.get(deviceId) || [];
            }
        } catch (error) {
            console.error('❌ Failed to get measurements:', error);
            return [];
        }
    }

    // Get measurements by type
    async getMeasurementsByType(type, limit = 100) {
        try {
            if (this.useFirebase) {
                const snapshot = await db.collection('measurements')
                    .where('type', '==', type)
                    .orderBy('timestamp', 'desc')
                    .limit(limit)
                    .get();

                const measurements = [];
                snapshot.forEach(doc => {
                    measurements.push({ id: doc.id, ...doc.data() });
                });
                return measurements;
            } else {
                // Fallback: search through all measurements
                const allMeasurements = [];
                for (const deviceMeasurements of fallbackMeasurements.values()) {
                    allMeasurements.push(...deviceMeasurements.filter(m => m.type === type));
                }
                return allMeasurements.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
            }
        } catch (error) {
            console.error('❌ Failed to get measurements by type:', error);
            return [];
        }
    }

    emitRealTimeData(deviceId, data) {
        const eventData = { deviceId, ...data, timestamp: new Date() };

        switch (data.type) {
            case 'BP':
                if (data.systolic && data.diastolic) {
                    io.emit('bp_measurement_complete', eventData);
                } else if (data.pressure) {
                    io.emit('bp_real_time_pressure', eventData);
                }
                break;
            case 'ECG':
                if (data.waveform) {
                    io.emit('ecg_waveform', eventData);
                }
                if (data.heartRate) {
                    io.emit('ecg_heart_rate', eventData);
                }
                break;
            case 'OXIMETER':
                io.emit('oximeter_data', eventData);
                break;
            case 'GLUCOSE':
                io.emit('glucose_data', eventData);
                break;
        }
    }
}

const deviceManager = new FirebaseDeviceManager();

// 🌐 API Routes (same as before, but now using Firebase)

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        database: deviceManager.useFirebase ? 'Firebase' : 'In-Memory (Fallback)',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// Register device from mobile app
app.post('/api/devices/:id/connect', async (req, res) => {
    try {
        const deviceId = req.params.id;
        const deviceData = { id: deviceId, ...req.body };
        const clientId = req.ip;

        const device = await deviceManager.registerDevice(deviceData, clientId);

        res.json({
            success: true,
            message: 'Device registered successfully',
            device: device
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Blood Pressure measurement
app.post('/api/bp/:id/measurement', async (req, res) => {
    try {
        const deviceId = req.params.id;
        const measurementData = {
            type: 'BP',
            ...req.body
        };

        const measurement = await deviceManager.storeMeasurement(deviceId, measurementData);

        res.json({
            success: true,
            message: 'Blood pressure measurement saved',
            measurement: measurement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ECG data
app.post('/api/ecg/:id/data', async (req, res) => {
    try {
        const deviceId = req.params.id;
        const measurementData = {
            type: 'ECG',
            ...req.body
        };

        const measurement = await deviceManager.storeMeasurement(deviceId, measurementData);

        res.json({
            success: true,
            message: 'ECG data saved',
            measurement: measurement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Pulse Oximeter measurement
app.post('/api/oximeter/:id/measurement', async (req, res) => {
    try {
        const deviceId = req.params.id;
        const measurementData = {
            type: 'OXIMETER',
            ...req.body
        };

        const measurement = await deviceManager.storeMeasurement(deviceId, measurementData);

        res.json({
            success: true,
            message: 'Oximeter measurement saved',
            measurement: measurement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Blood Glucose measurement
app.post('/api/glucose/:id/measurement', async (req, res) => {
    try {
        const deviceId = req.params.id;
        const measurementData = {
            type: 'GLUCOSE',
            ...req.body
        };

        const measurement = await deviceManager.storeMeasurement(deviceId, measurementData);

        res.json({
            success: true,
            message: 'Glucose measurement saved',
            measurement: measurement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all devices
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await deviceManager.getAllDevices();
        res.json({
            success: true,
            devices: devices,
            count: devices.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get device history
app.get('/api/:type/:id/history', async (req, res) => {
    try {
        const { type, id } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const measurements = await deviceManager.getDeviceMeasurements(id, limit);

        res.json({
            success: true,
            measurements: measurements,
            count: measurements.length,
            deviceId: id,
            type: type
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get measurements by type
app.get('/api/measurements/:type', async (req, res) => {
    try {
        const type = req.params.type.toUpperCase();
        const limit = parseInt(req.query.limit) || 100;

        const measurements = await deviceManager.getMeasurementsByType(type, limit);

        res.json({
            success: true,
            measurements: measurements,
            count: measurements.length,
            type: type
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🔌 WebSocket connections
io.on('connection', (socket) => {
    connectedClients.add(socket.id);
    console.log(`📱 Client connected: ${socket.id} (Total: ${connectedClients.size})`);

    socket.on('join_device', (deviceId) => {
        socket.join(deviceId);
        console.log(`📱 Client ${socket.id} joined device room: ${deviceId}`);
    });

    socket.on('disconnect', () => {
        connectedClients.delete(socket.id);
        console.log(`📱 Client disconnected: ${socket.id} (Total: ${connectedClients.size})`);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('🏥 Medical Device API Server Started!');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔥 Database: ${deviceManager.useFirebase ? 'Firebase Firestore' : 'In-Memory (Fallback)'}`);
    console.log('📱 Mobile-First Architecture - Bluetooth handled by mobile apps');
    console.log('🔄 Real-time WebSocket support enabled');
    console.log('📚 API Endpoints:');
    console.log('   POST /api/devices/:id/connect    - Register device from mobile');
    console.log('   POST /api/bp/:id/measurement     - Store BP measurement');
    console.log('   POST /api/ecg/:id/data          - Store ECG data');
    console.log('   POST /api/oximeter/:id/measurement - Store SpO2 measurement');
    console.log('   POST /api/glucose/:id/measurement  - Store glucose measurement');
    console.log('   GET  /api/devices               - List all devices');
    console.log('   GET  /api/:type/:id/history     - Get measurement history');
    console.log('   GET  /api/measurements/:type    - Get measurements by type');
});