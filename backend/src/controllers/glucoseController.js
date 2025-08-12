const express = require('express');

const glucoseController = (deviceManager) => {
    const router = express.Router();

    // Start glucose measurement
    router.post('/:deviceId/measure', async (req, res) => {
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

            if (!deviceHandler.isGlucoseDevice()) {
                return res.status(400).json({
                    success: false,
                    error: 'Device does not support glucose measurement',
                    deviceId: deviceId
                });
            }

            await deviceHandler.startGlucoseMeasurement();

            res.json({
                success: true,
                message: 'Glucose measurement started',
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

    // Get latest glucose reading
    router.get('/:deviceId/latest', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const latestReading = await deviceHandler.getLatestGlucoseReading();

            if (!latestReading) {
                return res.status(404).json({
                    success: false,
                    error: 'No glucose readings available'
                });
            }

            res.json({
                success: true,
                deviceId: deviceId,
                reading: latestReading,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Get glucose measurement history
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

            const { startDate, endDate, limit = 50 } = req.query;
            const history = await deviceHandler.getGlucoseHistory({
                startDate,
                endDate,
                limit: parseInt(limit)
            });

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

    // Get device info (battery, calibration status, etc.)
    router.get('/:deviceId/info', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const deviceInfo = await deviceHandler.getGlucoseDeviceInfo();

            res.json({
                success: true,
                deviceId: deviceId,
                info: deviceInfo,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Get real-time measurement status
    router.get('/:deviceId/status', (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const status = deviceHandler.getGlucoseMeasurementStatus();

            res.json({
                success: true,
                deviceId: deviceId,
                status: status,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Delete glucose data from device
    router.delete('/:deviceId/data', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            await deviceHandler.deleteGlucoseData();

            res.json({
                success: true,
                message: 'Glucose data deleted from device',
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

    // Set measurement unit (mg/dL or mmol/L)
    router.post('/:deviceId/unit', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const { unit } = req.body; // 'mg/dL' or 'mmol/L'

            if (!['mg/dL', 'mmol/L'].includes(unit)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid unit. Must be mg/dL or mmol/L'
                });
            }

            await deviceHandler.setGlucoseUnit(unit);

            res.json({
                success: true,
                message: `Glucose unit set to ${unit}`,
                deviceId: deviceId,
                unit: unit,
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

module.exports = glucoseController;