const express = require('express');

const ecgController = (deviceManager) => {
    const router = express.Router();

    // Start ECG recording
    router.post('/:deviceId/start-recording', async (req, res) => {
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

            if (!deviceHandler.isECGDevice()) {
                return res.status(400).json({
                    success: false,
                    error: 'Device does not support ECG recording',
                    deviceId: deviceId
                });
            }

            const duration = req.body.duration || 30; // Default 30 seconds
            await deviceHandler.startECGRecording(duration);

            res.json({
                success: true,
                message: 'ECG recording started',
                deviceId: deviceId,
                duration: duration,
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

    // Stop ECG recording
    router.post('/:deviceId/stop-recording', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            await deviceHandler.stopECGRecording();

            res.json({
                success: true,
                message: 'ECG recording stopped',
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

    // Get real-time ECG data
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

            const currentData = deviceHandler.getCurrentECGData();

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

    // Get ECG files list
    router.get('/:deviceId/files', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const files = await deviceHandler.getECGFileList();

            res.json({
                success: true,
                deviceId: deviceId,
                files: files,
                count: files.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Download ECG file
    router.get('/:deviceId/files/:filename', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const filename = req.params.filename;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const fileData = await deviceHandler.downloadECGFile(filename);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);

            res.json({
                success: true,
                filename: filename,
                deviceId: deviceId,
                timestamp: new Date().toISOString(),
                data: fileData
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Delete ECG file
    router.delete('/:deviceId/files/:filename', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const filename = req.params.filename;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            await deviceHandler.deleteECGFile(filename);

            res.json({
                success: true,
                message: 'ECG file deleted successfully',
                filename: filename,
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

    // Get ECG analysis/diagnosis
    router.get('/:deviceId/analysis', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const deviceHandler = deviceManager.getConnectedDevice(deviceId);

            if (!deviceHandler) {
                return res.status(404).json({
                    success: false,
                    error: 'Device not connected'
                });
            }

            const analysis = await deviceHandler.getECGAnalysis();

            res.json({
                success: true,
                deviceId: deviceId,
                analysis: analysis,
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

module.exports = ecgController;