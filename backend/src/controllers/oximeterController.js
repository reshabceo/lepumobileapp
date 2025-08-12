const express = require('express');

const oximeterController = (deviceManager) => {
    const router = express.Router();

    // Get real-time oximeter data (SpO2, PR, PI)
    router.get('/:deviceId/real-time', (req, res) => {
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

            if (!deviceHandler.isOximeterDevice()) {
                return res.status(400).json({
                    success: false,
                    error: 'Device does not support pulse oximetry',
                    deviceId: deviceId
                });
            }

            const currentData = deviceHandler.getCurrentOximeterData();

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

    // Get pulse waveform data
    router.get('/:deviceId/waveform', (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const waveformData = deviceHandler.getPulseWaveform();

            res.json({
                success: true,
                deviceId: deviceId,
                timestamp: new Date().toISOString(),
                waveform: waveformData
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Get sleep monitoring data (for devices like O2Ring)
    router.get('/:deviceId/sleep-data', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            if (!deviceHandler.supportsSleepMonitoring()) {
                return res.status(400).json({
                    success: false,
                    error: 'Device does not support sleep monitoring'
                });
            }

            const sleepData = await deviceHandler.getSleepData();

            res.json({
                success: true,
                deviceId: deviceId,
                timestamp: new Date().toISOString(),
                sleepData: sleepData
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Get oximeter configuration
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

            const config = await deviceHandler.getOximeterConfig();

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

    // Update oximeter settings
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
            await deviceHandler.setOximeterConfig(config);

            res.json({
                success: true,
                message: 'Oximeter configuration updated successfully',
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

    // Get historical oximeter data
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

            const { startDate, endDate, limit = 100 } = req.query;
            const history = await deviceHandler.getOximeterHistory({
                startDate,
                endDate,
                limit: parseInt(limit)
            });

            res.json({
                success: true,
                deviceId: deviceId,
                records: history,
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

    // Start continuous monitoring
    router.post('/:deviceId/start-monitoring', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            await deviceHandler.startContinuousMonitoring();

            res.json({
                success: true,
                message: 'Continuous monitoring started',
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

    // Stop continuous monitoring
    router.post('/:deviceId/stop-monitoring', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            await deviceHandler.stopContinuousMonitoring();

            res.json({
                success: true,
                message: 'Continuous monitoring stopped',
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

module.exports = oximeterController;