const express = require('express');

const bloodPressureController = (deviceManager) => {
    const router = express.Router();

    // Start blood pressure measurement
    router.post('/:deviceId/start-measurement', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected',
                    deviceId: deviceId
                });
            }

            if (!deviceHandler.isBPDevice()) {
                return res.status(400).json({
                    success: false,
                    error: 'Device does not support blood pressure measurement',
                    deviceId: deviceId
                });
            }

            await deviceHandler.startBPMeasurement();

            res.json({
                success: true,
                message: 'Blood pressure measurement started',
                deviceId: deviceId,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
                deviceId: req.params.deviceId,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Stop blood pressure measurement
    router.post('/:deviceId/stop-measurement', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            await deviceHandler.stopBPMeasurement();

            res.json({
                success: true,
                message: 'Blood pressure measurement stopped',
                deviceId: deviceId,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Get real-time BP data
    router.get('/:deviceId/real-time', (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const currentData = deviceHandler.getCurrentBPData();

            res.json({
                success: true,
                deviceId: deviceId,
                timestamp: new Date().toISOString(),
                data: currentData
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Get measurement history
    router.get('/:deviceId/history', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const history = await deviceHandler.getBPHistory();

            res.json({
                success: true,
                deviceId: deviceId,
                measurements: history,
                count: history.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Get device configuration
    router.get('/:deviceId/config', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const config = await deviceHandler.getBPConfig();

            res.json({
                success: true,
                deviceId: deviceId,
                config: config,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Set device configuration
    router.post('/:deviceId/config', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const config = req.body;
            await deviceHandler.setBPConfig(config);

            res.json({
                success: true,
                message: 'Configuration updated successfully',
                deviceId: deviceId,
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

module.exports = bloodPressureController;