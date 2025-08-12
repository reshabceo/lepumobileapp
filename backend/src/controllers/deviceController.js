const express = require('express');

const deviceController = (deviceManager) => {
    const router = express.Router();

    // Get all discovered devices
    router.get('/', (req, res) => {
        try {
            const devices = deviceManager.getAllDevices();
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

    // Get specific device info
    router.get('/:deviceId', (req, res) => {
        try {
            const device = deviceManager.getDevice(req.params.deviceId);
            if (!device) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not found'
                });
            }

            res.json({
                success: true,
                device: device
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Connect to a device
    router.post('/:deviceId/connect', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const result = await deviceManager.connectDevice(deviceId);

            res.json({
                success: true,
                message: 'Device connected successfully',
                deviceId: deviceId,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
                deviceId: req.params.deviceId
            });
        }
    });

    // Disconnect from a device
    router.delete('/:deviceId/connect', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            await deviceManager.disconnectDevice(deviceId);

            res.json({
                success: true,
                message: 'Device disconnected successfully',
                deviceId: deviceId,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
                deviceId: req.params.deviceId
            });
        }
    });

    // Get device connection status
    router.get('/:deviceId/status', (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const device = deviceManager.getDevice(deviceId);

            if (!device) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not found'
                });
            }

            const isConnected = deviceManager.isDeviceConnected(deviceId);
            const handler = deviceManager.getConnectedDevice(deviceId);

            res.json({
                success: true,
                deviceId: deviceId,
                connected: isConnected,
                status: {
                    name: device.name,
                    model: device.model,
                    macAddress: device.macAddress,
                    battery: handler ? handler.getBatteryLevel() : null,
                    lastSeen: device.lastSeen
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Start device discovery/scanning
    router.post('/scan/start', (req, res) => {
        try {
            deviceManager.startScanning();
            res.json({
                success: true,
                message: 'Device scanning started',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Stop device discovery/scanning
    router.post('/scan/stop', (req, res) => {
        try {
            deviceManager.stopScanning();
            res.json({
                success: true,
                message: 'Device scanning stopped',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    return router;
};

module.exports = deviceController;