const express = require('express');
const bloodPressureController = require('./bloodPressureController');
const ecgController = require('./ecgController');
const oximeterController = require('./oximeterController');
const glucoseController = require('./glucoseController');
const deviceController = require('./deviceController');
const lepuController = require('./lepuController');

const createRoutes = (deviceManager) => {
    const router = express.Router();

    // Health check endpoint
    router.get('/health', (req, res) => {
        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            devices: {
                discovered: deviceManager.getDeviceCount(),
                connected: deviceManager.getConnectedCount()
            },
            bluetooth: {
                state: deviceManager.getBluetoothState(),
                scanning: deviceManager.isScanning()
            },
            lepuDemo: {
                supported: true,
                models: 15 // Number of supported LepuDemo models
            }
        };

        res.json(health);
    });

    // Device management routes
    router.use('/devices', deviceController(deviceManager));

    // Device-specific routes
    router.use('/bp', bloodPressureController(deviceManager));
    router.use('/ecg', ecgController(deviceManager));
    router.use('/oximeter', oximeterController(deviceManager));
    router.use('/glucose', glucoseController(deviceManager));

    // LepuDemo specific routes
    router.use('/lepu', lepuController(deviceManager));

    return router;
};

module.exports = createRoutes;