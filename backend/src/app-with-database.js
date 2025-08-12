// Medical Device Backend API - With MongoDB Database
// Mobile-Ready Architecture with Persistent Storage

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Import models
const Device = require('./models/Device');
const Measurement = require('./models/Measurement');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Connect to MongoDB
const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URL || 'mongodb://localhost:27017/medical_devices';
        await mongoose.connect(mongoUri);
        console.log('📊 Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Initialize database connection
connectDB();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Mobile Device Manager with Database
class DatabaseDeviceManager {
    constructor() {
        this.connectedClients = new Set();
    }

    // Register device in database
    async registerDevice(deviceData, clientId) {
        try {
            const device = await Device.findOneAndUpdate(
                { deviceId: deviceData.id },
                {
                    deviceId: deviceData.id,
                    name: deviceData.name,
                    model: deviceData.model,
                    macAddress: deviceData.macAddress,
                    type: deviceData.type,
                    connected: true,
                    clientId: clientId,
                    battery: deviceData.battery,
                    firmware: deviceData.firmware,
                    lastSeen: new Date()
                },
                { upsert: true, new: true }
            );

            // Notify all clients about device connection
            io.emit('device_discovered', device);
            io.emit('device_connected', { deviceId: device.deviceId });

            console.log(`📱 Device registered: ${device.name} (${device.type})`);
            return device;
        } catch (error) {
            console.error('❌ Error registering device:', error);
            throw error;
        }
    }

    // Store measurement in database
    async storeMeasurement(deviceId, measurementData) {
        try {
            const measurement = new Measurement({
                measurementId: uuidv4(),
                deviceId: deviceId,
                timestamp: new Date(),
                ...measurementData
            });

            await measurement.save();

            // Emit real-time data based on device type
            await this.emitRealTimeData(deviceId, measurementData);

            console.log(`📊 Measurement stored: ${measurementData.type} for ${deviceId}`);
            return measurement;
        } catch (error) {
            console.error('❌ Error storing measurement:', error);
            throw error;
        }
    }

    async emitRealTimeData(deviceId, data) {
        try {
            const device = await Device.findOne({ deviceId });
            if (!device) return;

            const eventData = { deviceId, ...data, timestamp: new Date() };

            switch (device.type) {
                case 'BP':
                    if (data.systolic && data.diastolic) {
                        io.emit('bp_measurement_complete', eventData);
                    } else if (data.pressure) {
                        io.emit('bp_real_time_pressure', eventData);
                    }
                    break;
                case 'ECG':
                    io.emit('ecg_real_time_data', eventData);
                    break;
                case 'OXIMETER':
                    io.emit('oxy_real_time_params', eventData);
                    break;
                case 'GLUCOSE':
                    io.emit('glucose_result', eventData);
                    break;
            }
        } catch (error) {
            console.error('❌ Error emitting real-time data:', error);
        }
    }

    async getAllDevices() {
        try {
            return await Device.find().sort({ lastSeen: -1 });
        } catch (error) {
            console.error('❌ Error getting devices:', error);
            return [];
        }
    }

    async getDevice(deviceId) {
        try {
            return await Device.findOne({ deviceId });
        } catch (error) {
            console.error('❌ Error getting device:', error);
            return null;
        }
    }

    async getDeviceMeasurements(deviceId, type = null, limit = 50) {
        try {
            const query = { deviceId };
            if (type) query.type = type;

            return await Measurement.find(query)
                .sort({ timestamp: -1 })
                .limit(limit);
        } catch (error) {
            console.error('❌ Error getting measurements:', error);
            return [];
        }
    }

    async disconnectDevice(deviceId) {
        try {
            await Device.findOneAndUpdate(
                { deviceId },
                { connected: false }
            );
            io.emit('device_disconnected', { deviceId });
            console.log(`🔌 Device disconnected: ${deviceId}`);
        } catch (error) {
            console.error('❌ Error disconnecting device:', error);
        }
    }

    async getStats() {
        try {
            const deviceCount = await Device.countDocuments();
            const connectedCount = await Device.countDocuments({ connected: true });
            const measurementCount = await Measurement.countDocuments();

            return {
                devices: deviceCount,
                connected: connectedCount,
                measurements: measurementCount
            };
        } catch (error) {
            console.error('❌ Error getting stats:', error);
            return { devices: 0, connected: 0, measurements: 0 };
        }
    }
}

const deviceManager = new DatabaseDeviceManager();

// API Routes
app.get('/api/health', async (req, res) => {
    const stats = await deviceManager.getStats();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'mongodb',
        devices: {
            discovered: stats.devices,
            connected: stats.connected
        },
        measurements: stats.measurements,
        architecture: 'mobile-first',
        bluetoothHandling: 'mobile-native'
    });
});

// Device Management Routes
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await deviceManager.getAllDevices();
        res.json({
            success: true,
            count: devices.length,
            devices: devices
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Mobile app registers/connects a device
app.post('/api/devices/:deviceId/connect', async (req, res) => {
    try {
        const deviceData = req.body;
        const device = await deviceManager.registerDevice({
            id: req.params.deviceId,
            ...deviceData
        }, req.ip);

        res.json({
            success: true,
            message: 'Device connected successfully',
            device: device
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Disconnect device
app.delete('/api/devices/:deviceId/connect', async (req, res) => {
    try {
        await deviceManager.disconnectDevice(req.params.deviceId);
        res.json({
            success: true,
            message: 'Device disconnected successfully',
            deviceId: req.params.deviceId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get device status
app.get('/api/devices/:deviceId/status', async (req, res) => {
    try {
        const device = await deviceManager.getDevice(req.params.deviceId);
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        res.json({
            success: true,
            deviceId: req.params.deviceId,
            connected: device.connected,
            status: device
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Blood Pressure Routes
app.post('/api/bp/:deviceId/measurement', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const measurementData = req.body;

        const measurement = await deviceManager.storeMeasurement(deviceId, {
            type: 'blood_pressure',
            ...measurementData
        });

        res.json({
            success: true,
            message: 'Blood pressure measurement stored',
            measurement: measurement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/bp/:deviceId/history', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const limit = parseInt(req.query.limit) || 50;
        const measurements = await deviceManager.getDeviceMeasurements(deviceId, 'blood_pressure', limit);

        res.json({
            success: true,
            deviceId: deviceId,
            measurements: measurements,
            count: measurements.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ECG Routes
app.post('/api/ecg/:deviceId/data', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const ecgData = req.body;

        const measurement = await deviceManager.storeMeasurement(deviceId, {
            type: 'ecg',
            ...ecgData
        });

        res.json({
            success: true,
            message: 'ECG data stored',
            measurement: measurement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/ecg/:deviceId/history', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const limit = parseInt(req.query.limit) || 50;
        const measurements = await deviceManager.getDeviceMeasurements(deviceId, 'ecg', limit);

        res.json({
            success: true,
            deviceId: deviceId,
            recordings: measurements,
            count: measurements.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Pulse Oximeter Routes
app.post('/api/oximeter/:deviceId/measurement', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const oximeterData = req.body;

        const measurement = await deviceManager.storeMeasurement(deviceId, {
            type: 'oximeter',
            ...oximeterData
        });

        res.json({
            success: true,
            message: 'Oximeter measurement stored',
            measurement: measurement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/oximeter/:deviceId/history', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const limit = parseInt(req.query.limit) || 50;
        const measurements = await deviceManager.getDeviceMeasurements(deviceId, 'oximeter', limit);

        res.json({
            success: true,
            deviceId: deviceId,
            measurements: measurements,
            count: measurements.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Glucose Meter Routes
app.post('/api/glucose/:deviceId/measurement', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const glucoseData = req.body;

        const measurement = await deviceManager.storeMeasurement(deviceId, {
            type: 'glucose',
            ...glucoseData
        });

        res.json({
            success: true,
            message: 'Glucose measurement stored',
            measurement: measurement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/glucose/:deviceId/history', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const limit = parseInt(req.query.limit) || 50;
        const measurements = await deviceManager.getDeviceMeasurements(deviceId, 'glucose', limit);

        res.json({
            success: true,
            deviceId: deviceId,
            measurements: measurements,
            count: measurements.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// WebSocket handling
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    deviceManager.connectedClients.add(socket.id);

    // Send current devices to new client
    deviceManager.getAllDevices().then(devices => {
        socket.emit('devices_list', devices);
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
        deviceManager.connectedClients.delete(socket.id);
    });

    // Handle real-time data from mobile apps
    socket.on('device_data', async (data) => {
        if (data.deviceId && data.measurement) {
            try {
                await deviceManager.storeMeasurement(data.deviceId, data.measurement);
            } catch (error) {
                console.error('❌ Error storing device data:', error);
            }
        }
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await mongoose.connection.close();
    server.close(() => {
        console.log('👋 Server closed');
        process.exit(0);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('\n🏥 Medical Device API Server Started!');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📊 Database: MongoDB (Persistent Storage)`);
    console.log(`📱 Mobile-First Architecture - Bluetooth handled by mobile apps`);
    console.log(`🔄 Real-time WebSocket support enabled`);
    console.log('\n📚 API Endpoints:');
    console.log(`   POST /api/devices/:id/connect    - Register device from mobile`);
    console.log(`   POST /api/bp/:id/measurement     - Store BP measurement`);
    console.log(`   POST /api/ecg/:id/data          - Store ECG data`);
    console.log(`   POST /api/oximeter/:id/measurement - Store SpO2 measurement`);
    console.log(`   POST /api/glucose/:id/measurement  - Store glucose measurement`);
    console.log(`   GET  /api/devices               - List all devices`);
    console.log(`   GET  /api/:type/:id/history     - Get measurement history\n`);
});

module.exports = { app, server, io, deviceManager };