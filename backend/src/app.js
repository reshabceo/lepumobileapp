// Medical Device Backend API - Real-time Patient Monitoring System
// Enhanced with authentication and real-time data seeding

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// In-memory storage for demo (replace with database in production)
const devices = new Map();
const measurements = new Map();
const connectedClients = new Set();
const patients = new Map();

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Test user credentials
const testUser = {
    email: 'test@test.com',
    password: 'qweqwe', // In production, hash this password
    id: 'user-001',
    name: 'Dr. Smith',
    role: 'doctor'
};

// Middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:8080', 'http://localhost:8081', 'http://192.168.1.11:8080', 'http://192.168.1.11:8081', 'capacitor://localhost', 'ionic://localhost'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Mobile Device Manager
class MobileDeviceManager {
    constructor() {
        this.devices = new Map();
        this.measurements = new Map();
    }

    // Register device from mobile app
    registerDevice(deviceData, clientId) {
        const device = {
            id: deviceData.id || uuidv4(),
            name: deviceData.name,
            model: deviceData.model,
            macAddress: deviceData.macAddress,
            type: deviceData.type, // 'BP', 'ECG', 'OXIMETER', 'GLUCOSE'
            connected: true,
            clientId: clientId,
            lastSeen: new Date(),
            connectedAt: new Date(), // When device was first connected
            battery: deviceData.battery || null,
            firmware: deviceData.firmware || null,
            status: 'idle', // Device status: 'idle', 'active', 'measuring'
            monitoringMode: null, // Monitoring mode when active
            lastActivated: null,
            lastDeactivated: null,
            connectionDuration: 0, // Duration in seconds
            // Preserve additional properties like manufacturer, capabilities, etc.
            ...(deviceData.manufacturer && { manufacturer: deviceData.manufacturer }),
            ...(deviceData.capabilities && { capabilities: deviceData.capabilities }),
            ...(deviceData.serviceUUID && { serviceUUID: deviceData.serviceUUID })
        };

        this.devices.set(device.id, device);

        // Notify all clients about new device
        io.emit('device_discovered', device);
        io.emit('device_connected', { deviceId: device.id });

        return device;
    }

    // Get device by ID
    getDevice(deviceId) {
        return this.devices.get(deviceId);
    }

    // Update connection duration for all connected devices
    updateConnectionDurations() {
        const now = new Date();
        this.devices.forEach(device => {
            if (device.connected && device.connectedAt) {
                const duration = Math.floor((now - new Date(device.connectedAt)) / 1000);
                device.connectionDuration = duration;
            }
        });
    }

    // Format connection duration
    formatConnectionDuration(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes}m ${seconds % 60}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    // Store measurement data from mobile app
    storeMeasurement(deviceId, measurementData) {
        const measurement = {
            id: uuidv4(),
            deviceId: deviceId,
            timestamp: new Date(),
            ...measurementData
        };

        if (!this.measurements.has(deviceId)) {
            this.measurements.set(deviceId, []);
        }

        this.measurements.get(deviceId).push(measurement);

        // Keep only last 100 measurements per device
        const deviceMeasurements = this.measurements.get(deviceId);
        if (deviceMeasurements.length > 100) {
            this.measurements.set(deviceId, deviceMeasurements.slice(-100));
        }

        // Emit real-time data based on device type
        this.emitRealTimeData(deviceId, measurementData);

        return measurement;
    }

    emitRealTimeData(deviceId, data) {
        const device = this.devices.get(deviceId);
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
    }

    getAllDevices() {
        // Update connection durations before returning
        this.updateConnectionDurations();
        
        return Array.from(this.devices.values()).map(device => ({
            ...device,
            connectedAt: device.connectedAt,
            connectionDuration: device.connectionDuration,
            connectionDurationFormatted: device.connectedAt ? this.formatConnectionDuration(device.connectionDuration) : null,
            connectedAtFormatted: device.connectedAt ? device.connectedAt.toLocaleString() : null
        }));
    }

    getDevice(deviceId) {
        return this.devices.get(deviceId);
    }

    getDeviceMeasurements(deviceId, limit = 50) {
        const measurements = this.measurements.get(deviceId) || [];
        return measurements.slice(-limit).reverse();
    }

    disconnectDevice(deviceId) {
        const device = this.devices.get(deviceId);
        if (device) {
            device.connected = false;
            io.emit('device_disconnected', { deviceId });
        }
    }
}

const deviceManager = new MobileDeviceManager();

// Initialize Real-time Patient Data System
function initializePatientData() {
    console.log('🏥 Initializing 5 patients with BP and ECG monitoring devices...');

    const patientNames = [
        'John Smith', 'Emily Johnson', 'Michael Brown', 'Sarah Davis', 'Robert Wilson'
    ];

    const conditions = [
        'Hypertension', 'Diabetes Type 2', 'Cardiac Arrhythmia', 'Asthma', 'Obesity'
    ];

    // Create BP device connected to the app
    const singleBPDevice = {
        id: 'bp-monitor-001',
        name: 'Blood Pressure Monitor',
        model: 'BP3',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        type: 'BP',
        connected: true,
        battery: 85,
        firmware: '1.0.1',
        clientId: 'mobile-app'
    };

    // Create ECG device connected to the app
    const singleECGDevice = {
        id: 'ecg-monitor-001',
        name: 'ECG Monitor',
        model: 'ECG2',
        macAddress: 'AA:BB:CC:DD:EE:GG',
        type: 'ECG',
        connected: true,
        battery: 90,
        firmware: '1.2.0',
        clientId: 'mobile-app'
    };

    // Register the devices
    deviceManager.registerDevice(singleBPDevice, 'mobile-app');
    deviceManager.registerDevice(singleECGDevice, 'mobile-app');

    // Create 5 patients with the shared BP device
    patientNames.forEach((name, patientIndex) => {
        const patientId = `patient-${patientIndex + 1}`;
        const patient = {
            id: patientId,
            name: name,
            age: 35 + Math.floor(Math.random() * 30),
            condition: conditions[patientIndex],
            devices: [singleBPDevice.id] // All patients share the same BP device ID
        };

        patients.set(patientId, patient);
    });

    console.log(`✅ Created ${patientNames.length} patients with 1 shared BP monitoring device and 1 ECG monitoring device`);

    // Start real-time data generation
    startRealTimeDataGeneration();
}

// Real-time data generation system
function startRealTimeDataGeneration() {
    console.log('🔄 BP data generation system ready (will only generate when monitoring is active)...');
    console.log('🔄 ECG data generation system ready (will only generate when monitoring is active)...');

    // Generate new measurements only when device is actively monitoring
    let bpMonitoringInterval = null;
    let ecgMonitoringInterval = null;
    
    // Function to start BP monitoring and generate one reading
    const startBPMonitoring = () => {
        const device = deviceManager.getDevice('bp-monitor-001');
        if (!device || device.status !== 'active') return;

        const now = new Date();
        
        // Realistic BP readings with some variation
        const baseSystolic = 110 + Math.floor(Math.random() * 30);
        const baseDiastolic = 70 + Math.floor(Math.random() * 20);
        const measurement = {
            type: 'blood_pressure',
            patientId: 'shared', // Shared device for all patients
            systolic: baseSystolic + Math.floor(Math.random() * 10 - 5),
            diastolic: baseDiastolic + Math.floor(Math.random() * 8 - 4),
            mean: Math.floor((baseSystolic + 2 * baseDiastolic) / 3),
            pulseRate: 65 + Math.floor(Math.random() * 20),
            unit: 'mmHg',
            timestamp: now.toISOString()
        };

        deviceManager.storeMeasurement('bp-monitor-001', measurement);
        console.log(`📊 BP Reading generated: ${measurement.systolic}/${measurement.diastolic} mmHg (Pulse: ${measurement.pulseRate} BPM)`);
        
        // Stop monitoring after one reading
        device.status = 'idle';
        device.lastDeactivated = new Date();
        
        // Emit deactivation event
        io.emit('device_deactivated', {
            deviceId: 'bp-monitor-001',
            deviceType: 'BP',
            status: 'idle',
            timestamp: new Date()
        });
        
        console.log(`🏥 Device bp-monitor-001 deactivated - Single reading completed`);
    };

    // Function to start ECG monitoring and generate one reading
    const startECGMonitoring = () => {
        const device = deviceManager.getDevice('ecg-monitor-001');
        if (!device || device.status !== 'active') return;

        const now = new Date();
        
        // Realistic ECG rhythm analysis
        const rhythmTypes = ['normal', 'irregular', 'bradycardia', 'tachycardia', 'afib', 'arrhythmia'];
        const rhythm = rhythmTypes[Math.floor(Math.random() * rhythmTypes.length)];
        
        let heartRate;
        switch (rhythm) {
            case 'bradycardia':
                heartRate = 45 + Math.floor(Math.random() * 15); // 45-60 BPM
                break;
            case 'tachycardia':
                heartRate = 100 + Math.floor(Math.random() * 30); // 100-130 BPM
                break;
            default:
                heartRate = 60 + Math.floor(Math.random() * 40); // 60-100 BPM
        }

        const measurement = {
            type: 'ecg_rhythm',
            patientId: 'shared',
            heartRate: heartRate,
            rhythm: rhythm,
            qrsDuration: 80 + Math.floor(Math.random() * 40), // 80-120 ms
            qtInterval: 350 + Math.floor(Math.random() * 100), // 350-450 ms
            prInterval: 120 + Math.floor(Math.random() * 60), // 120-180 ms
            stSegment: Math.random() > 0.8 ? 'elevated' : 'normal',
            tWave: Math.random() > 0.9 ? 'inverted' : 'normal',
            pWave: Math.random() > 0.95 ? 'absent' : 'normal',
            ecgData: Array.from({ length: 100 }, () => Math.random() * 2 - 1), // Simulated ECG waveform
            unit: 'mV',
            timestamp: now.toISOString()
        };

        deviceManager.storeMeasurement('ecg-monitor-001', measurement);
        console.log(`📊 ECG Reading generated: ${heartRate} BPM, Rhythm: ${rhythm}`);
        
        // Emit ECG measurement event for real-time updates
        io.emit('ecg_measurement', {
            deviceId: 'ecg-monitor-001',
            ...measurement
        });
        
        // Stop monitoring after one reading
        device.status = 'idle';
        device.lastDeactivated = new Date();
        
        // Emit deactivation event
        io.emit('device_deactivated', {
            deviceId: 'ecg-monitor-001',
            deviceType: 'ECG',
            status: 'idle',
            timestamp: new Date()
        });
        
        console.log(`🏥 Device ecg-monitor-001 deactivated - Single reading completed`);
    };

    // Check BP device status every second
    setInterval(() => {
        const device = deviceManager.getDevice('bp-monitor-001');
        if (device && device.status === 'active' && !bpMonitoringInterval) {
            // Start monitoring and generate one reading after 5 seconds
            bpMonitoringInterval = setTimeout(() => {
                startBPMonitoring();
                bpMonitoringInterval = null;
            }, 5000);
        }
    }, 1000); // Check every second

    // Check ECG device status every second
    setInterval(() => {
        const device = deviceManager.getDevice('ecg-monitor-001');
        if (device && device.status === 'active' && !ecgMonitoringInterval) {
            // Start monitoring and generate one reading after 5 seconds
            ecgMonitoringInterval = setTimeout(() => {
                startECGMonitoring();
                ecgMonitoringInterval = null;
            }, 5000);
        }
    }, 1000); // Check every second

    // Simulate device battery drain and occasional disconnections
    setInterval(() => {
        devices.forEach((device, deviceId) => {
            if (Math.random() > 0.95) { // 5% chance per minute
                const newBattery = Math.max(0, device.battery - Math.floor(Math.random() * 3));
                device.battery = newBattery;

                // Disconnect if battery is too low
                if (newBattery < 10) {
                    device.connected = false;
                    io.emit('device_disconnected', { deviceId, reason: 'Low battery' });
                } else if (!device.connected && newBattery > 20 && Math.random() > 0.7) {
                    // Reconnect if battery recovered
                    device.connected = true;
                    io.emit('device_connected', { deviceId });
                }
            }
        });
    }, 60000); // Check every minute
}

// Initialize patient data system
initializePatientData();

// Authentication Routes
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (email === testUser.email && password === testUser.password) {
        const token = jwt.sign(
            {
                id: testUser.id,
                email: testUser.email,
                name: testUser.name,
                role: testUser.role
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token: token,
            user: {
                id: testUser.id,
                email: testUser.email,
                name: testUser.name,
                role: testUser.role
            }
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }
});

// Protected route to verify token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// API Routes
app.get('/api/health', (req, res) => {
    const connectedDevices = deviceManager.getAllDevices().filter(d => d.connected);
    const totalPatients = patients.size;
    const lepuDevices = deviceManager.getAllDevices().filter(d => d.manufacturer === 'LepuDemo');
    
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        patients: totalPatients,
        devices: {
            discovered: deviceManager.getAllDevices().length,
            connected: connectedDevices.length
        },
        lepuDemo: {
            supported: true,
            devices: lepuDevices.length,
            models: 15,
            endpoints: [
                'GET /api/lepu/models',
                'POST /api/lepu/devices/:id/register',
                'GET /api/lepu/devices/:id/status',
                'POST /api/lepu/bp/:id/measurement',
                'POST /api/lepu/ecg/:id/data',
                'POST /api/lepu/oximeter/:id/measurement',
                'POST /api/lepu/glucose/:id/measurement',
                'GET /api/lepu/devices/:id/history'
            ]
        },
        architecture: 'realtime-patient-monitoring',
        dataGeneration: 'active'
    });
});

// Patient Routes
app.get('/api/patients', (req, res) => {
    const patientList = Array.from(patients.values()).map(patient => ({
        ...patient,
        deviceStatus: patient.devices.map(deviceId => {
            const device = deviceManager.getDevice(deviceId);
            return {
                deviceId,
                type: device?.type,
                connected: device?.connected,
                battery: device?.battery
            };
        })
    }));

    res.json({
        success: true,
        patients: patientList,
        count: patientList.length
    });
});

app.get('/api/patients/:patientId', (req, res) => {
    const patient = patients.get(req.params.patientId);
    if (!patient) {
        return res.status(404).json({
            success: false,
            error: 'Patient not found'
        });
    }

    // Get latest measurements for each device
    const patientDevices = patient.devices.map(deviceId => {
        const device = deviceManager.getDevice(deviceId);
        const measurements = deviceManager.getDeviceMeasurements(deviceId, 5);
        return {
            ...device,
            latestMeasurements: measurements
        };
    });

    res.json({
        success: true,
        patient: {
            ...patient,
            devices: patientDevices
        }
    });
});

// Device Management Routes
app.get('/api/devices', (req, res) => {
    const devices = deviceManager.getAllDevices();
    res.json({
        success: true,
        count: devices.length,
        devices: devices
    });
});

// Mobile app registers/connects a device
app.post('/api/devices/:deviceId/connect', (req, res) => {
    const deviceData = req.body;
    const device = deviceManager.registerDevice({
        id: req.params.deviceId,
        ...deviceData
    }, req.ip);

    res.json({
        success: true,
        message: 'Device connected successfully',
        device: device
    });
});

// Activate device for monitoring
app.post('/api/devices/:deviceId/activate', (req, res) => {
    const deviceId = req.params.deviceId;
    const { command, deviceType, parameters } = req.body;
    
    try {
        const device = deviceManager.getDevice(deviceId);
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        if (!device.connected) {
            return res.status(400).json({
                success: false,
                error: 'Device is not connected'
            });
        }

        // Activate the device based on type
        if (deviceType === 'BP') {
            // For BP devices, start monitoring mode
            device.status = 'active';
            device.monitoringMode = parameters?.measurementMode || 'automatic';
            device.lastActivated = new Date();
            
            // Emit activation event
            io.emit('device_activated', {
                deviceId: deviceId,
                deviceType: deviceType,
                status: 'active',
                timestamp: new Date()
            });

            console.log(`🏥 BP Device ${deviceId} activated for monitoring - Readings will start in 5 seconds`);

            res.json({
                success: true,
                message: 'Device activated successfully - BP readings will start in 5 seconds',
                device: device
            });
        } else if (deviceType === 'ECG') {
            // For ECG devices, start monitoring mode
            device.status = 'active';
            device.monitoringMode = parameters?.measurementMode || 'continuous';
            device.lastActivated = new Date();
            
            // Emit activation event
            io.emit('device_activated', {
                deviceId: deviceId,
                deviceType: deviceType,
                status: 'active',
                timestamp: new Date()
            });

            console.log(`🏥 ECG Device ${deviceId} activated for monitoring - Rhythm analysis will start in 5 seconds`);

            res.json({
                success: true,
                message: 'Device activated successfully - ECG rhythm analysis will start in 5 seconds',
                device: device
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Unsupported device type'
            });
        }
    } catch (error) {
        console.error('Device activation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to activate device'
        });
    }
});

// Deactivate device
app.post('/api/devices/:deviceId/deactivate', (req, res) => {
    const deviceId = req.params.deviceId;
    const { command, deviceType } = req.body;
    
    try {
        const device = deviceManager.getDevice(deviceId);
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // Deactivate the device
        device.status = 'idle';
        device.monitoringMode = null;
        device.lastDeactivated = new Date();
        
        // Emit deactivation event
        io.emit('device_deactivated', {
            deviceId: deviceId,
            deviceType: deviceType,
            status: 'idle',
            timestamp: new Date()
        });

        if (deviceType === 'ECG') {
            console.log(`🏥 Device ${deviceId} deactivated - ECG rhythm analysis stopped`);
            res.json({
                success: true,
                message: 'Device deactivated successfully - ECG rhythm analysis stopped',
                device: device
            });
        } else {
            console.log(`🏥 Device ${deviceId} deactivated - BP readings stopped`);
            res.json({
                success: true,
                message: 'Device deactivated successfully - BP readings stopped',
                device: device
            });
        }
    } catch (error) {
        console.error('Device deactivation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to deactivate device'
        });
    }
});

// Disconnect device
app.delete('/api/devices/:deviceId/connect', (req, res) => {
    deviceManager.disconnectDevice(req.params.deviceId);
    res.json({
        success: true,
        message: 'Device disconnected successfully',
        deviceId: req.params.deviceId
    });
});

// Get device status
app.get('/api/devices/:deviceId/status', (req, res) => {
    const device = deviceManager.getDevice(req.params.deviceId);
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
});

// Blood Pressure Routes
app.post('/api/bp/:deviceId/measurement', (req, res) => {
    const deviceId = req.params.deviceId;
    const measurementData = req.body;

    const measurement = deviceManager.storeMeasurement(deviceId, {
        type: 'blood_pressure',
        ...measurementData
    });

    res.json({
        success: true,
        message: 'Blood pressure measurement stored',
        measurement: measurement
    });
});

app.get('/api/bp/:deviceId/history', (req, res) => {
    const deviceId = req.params.deviceId;
    const limit = parseInt(req.query.limit) || 50;
    const measurements = deviceManager.getDeviceMeasurements(deviceId, limit)
        .filter(m => m.type === 'blood_pressure');

    res.json({
        success: true,
        deviceId: deviceId,
        measurements: measurements,
        count: measurements.length
    });
});

// ECG Routes
app.post('/api/ecg/:deviceId/data', (req, res) => {
    const deviceId = req.params.deviceId;
    const ecgData = req.body;

    const measurement = deviceManager.storeMeasurement(deviceId, {
        type: 'ecg',
        ...ecgData
    });

    res.json({
        success: true,
        message: 'ECG data stored',
        measurement: measurement
    });
});

app.get('/api/ecg/:deviceId/history', (req, res) => {
    const deviceId = req.params.deviceId;
    const limit = parseInt(req.query.limit) || 50;
    const measurements = deviceManager.getDeviceMeasurements(deviceId, limit)
        .filter(m => m.type === 'ecg_rhythm');

    res.json({
        success: true,
        deviceId: deviceId,
        rhythms: measurements,
        count: measurements.length
    });
});

// Pulse Oximeter Routes
app.post('/api/oximeter/:deviceId/measurement', (req, res) => {
    const deviceId = req.params.deviceId;
    const oximeterData = req.body;

    const measurement = deviceManager.storeMeasurement(deviceId, {
        type: 'oximeter',
        ...oximeterData
    });

    res.json({
        success: true,
        message: 'Oximeter measurement stored',
        measurement: measurement
    });
});

app.get('/api/oximeter/:deviceId/history', (req, res) => {
    const deviceId = req.params.deviceId;
    const limit = parseInt(req.query.limit) || 50;
    const measurements = deviceManager.getDeviceMeasurements(deviceId, limit)
        .filter(m => m.type === 'oximeter');

    res.json({
        success: true,
        deviceId: deviceId,
        measurements: measurements,
        count: measurements.length
    });
});

// Glucose Meter Routes
app.post('/api/glucose/:deviceId/measurement', (req, res) => {
    const deviceId = req.params.deviceId;
    const glucoseData = req.body;

    const measurement = deviceManager.storeMeasurement(deviceId, {
        type: 'glucose',
        ...glucoseData
    });

    res.json({
        success: true,
        message: 'Glucose measurement stored',
        measurement: measurement
    });
});

app.get('/api/glucose/:deviceId/history', (req, res) => {
    const deviceId = req.params.deviceId;
    const limit = parseInt(req.query.limit) || 50;
    const measurements = deviceManager.getDeviceMeasurements(deviceId, limit)
        .filter(m => m.type === 'glucose');

    res.json({
        success: true,
        deviceId: deviceId,
        measurements: measurements,
        count: measurements.length
    });
});

// LepuDemo Routes
// Get all LepuDemo device models
app.get('/api/lepu/models', (req, res) => {
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

    res.json({
        success: true,
        models: LEPU_DEVICE_MODELS,
        count: Object.keys(LEPU_DEVICE_MODELS).length
    });
});

// Register a LepuDemo device
app.post('/api/lepu/devices/:deviceId/register', (req, res) => {
    const { deviceId } = req.params;
    const { model, macAddress, name, firmware, battery } = req.body;

    const LEPU_DEVICE_MODELS = {
        'BP2': { type: 'BP', name: 'BP2 Blood Pressure Monitor' },
        'BP3': { type: 'BP', name: 'BP3 Blood Pressure Monitor' },
        'AirBP': { type: 'BP', name: 'AirBP Blood Pressure Monitor' },
        'BPM-188': { type: 'BP', name: 'BPM-188 Blood Pressure Monitor' },
        'ER1': { type: 'ECG', name: 'ER1 ECG Device' },
        'ER2': { type: 'ECG', name: 'ER2 ECG Device' },
        'ER3': { type: 'ECG', name: 'ER3 ECG Device' },
        'PC-80B': { type: 'ECG', name: 'PC-80B ECG Device' },
        'PC-300': { type: 'ECG', name: 'PC-300 ECG Device' },
        'PC-60FW': { type: 'OXIMETER', name: 'PC-60FW Pulse Oximeter' },
        'O2Ring': { type: 'OXIMETER', name: 'O2Ring Pulse Oximeter' },
        'SP20': { type: 'OXIMETER', name: 'SP20 Pulse Oximeter' },
        'PF-10AW': { type: 'OXIMETER', name: 'PF-10AW Pulse Oximeter' },
        'Bioland-BGM': { type: 'GLUCOSE', name: 'Bioland Blood Glucose Meter' },
        'LPM311': { type: 'GLUCOSE', name: 'LPM311 Blood Glucose Meter' }
    };

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
app.get('/api/lepu/devices/:deviceId/status', (req, res) => {
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

// LepuDemo Blood Pressure measurement
app.post('/api/lepu/bp/:deviceId/measurement', (req, res) => {
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
        deviceModel: 'BP2'
    };

    const storedMeasurement = deviceManager.storeMeasurement(deviceId, measurement);
    
    res.json({
        success: true,
        message: 'LepuDemo blood pressure measurement stored',
        measurement: storedMeasurement
    });
});

// LepuDemo ECG data
app.post('/api/lepu/ecg/:deviceId/data', (req, res) => {
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
        deviceModel: 'PC-80B'
    };

    const storedMeasurement = deviceManager.storeMeasurement(deviceId, measurement);
    
    res.json({
        success: true,
        message: 'LepuDemo ECG data stored',
        measurement: storedMeasurement
    });
});

// LepuDemo Pulse Oximeter measurement
app.post('/api/lepu/oximeter/:deviceId/measurement', (req, res) => {
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
        deviceModel: 'PC-60FW'
    };

    const storedMeasurement = deviceManager.storeMeasurement(deviceId, measurement);
    
    res.json({
        success: true,
        message: 'LepuDemo pulse oximeter measurement stored',
        measurement: storedMeasurement
    });
});

// LepuDemo Blood Glucose measurement
app.post('/api/lepu/glucose/:deviceId/measurement', (req, res) => {
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
        deviceModel: 'Bioland-BGM'
    };

    const storedMeasurement = deviceManager.storeMeasurement(deviceId, measurement);
    
    res.json({
        success: true,
        message: 'LepuDemo glucose measurement stored',
        measurement: storedMeasurement
    });
});

// Get LepuDemo device history
app.get('/api/lepu/devices/:deviceId/history', (req, res) => {
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

// Helper functions for LepuDemo
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

// WebSocket handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    connectedClients.add(socket.id);

    // Send current devices to new client
    const devices = deviceManager.getAllDevices();
    socket.emit('devices_list', devices);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        connectedClients.delete(socket.id);
    });

    // Handle real-time data from mobile apps
    socket.on('device_data', (data) => {
        if (data.deviceId && data.measurement) {
            deviceManager.storeMeasurement(data.deviceId, data.measurement);
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

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('\n🏥 Blood Pressure Monitoring System Started!');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    console.log(`👨‍⚕️ Real-time BP monitoring for 5 patients with 1 shared BP device`);
    console.log(`🔄 WebSocket real-time updates every 5 seconds`);
    console.log(`🔑 Test Login: test@test.com / qweqwe`);
    console.log('\n📚 API Endpoints:');
    console.log(`   POST /api/auth/login            - Login with credentials`);
    console.log(`   GET  /api/auth/verify           - Verify JWT token`);
    console.log(`   GET  /api/patients              - List all patients`);
    console.log(`   GET  /api/patients/:id          - Get patient details`);
    console.log(`   GET  /api/devices               - List all devices`);
    console.log(`   GET  /api/:type/:id/history     - Get measurement history`);
    console.log('\n🎯 Patients with Shared BP Device:');
    patients.forEach((patient, id) => {
        console.log(`   ${patient.name} (${patient.condition}) - Uses shared BP device`);
    });
    console.log('');
});

module.exports = { app, server, io, deviceManager };