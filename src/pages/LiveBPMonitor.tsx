import React, { useEffect, useState, useCallback } from 'react';
import { wellueSDK, BPMeasurement, BPStatus, BPProgress, RealTimeData } from '../lib/wellue-sdk-bridge';
import { useDevice } from '../contexts/DeviceContext';
import { useRealTimeVitals } from '../hooks/useRealTimeVitals';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import {
    Activity,
    Bluetooth,
    BluetoothOff,
    Heart,
    Play,
    Square,
    RefreshCw,
    Battery,
    AlertCircle,
    CheckCircle,
    Clock
} from 'lucide-react';

interface BPMeasurementState {
    status: BPStatus;
    history: BPMeasurement[];
    realTimeData?: RealTimeData;
}

const LiveBPMonitor: React.FC = () => {
    // Use shared device context
    const {
        connectedDevice,
        bluetoothEnabled,
        error: deviceError,
        startBPMeasurement: startBPFromContext,
        stopMeasurement: stopMeasurementFromContext
    } = useDevice();

    const { addVitalSign } = useRealTimeVitals();

    // BP measurement state
    const [bpState, setBpState] = useState<BPMeasurementState>({
        status: {
            isMeasuring: false,
            currentPressure: 0,
            status: 'idle',
            lastMeasurement: undefined,
            error: undefined
        },
        history: [],
        realTimeData: undefined
    });

    // Initialize BP-specific callbacks
    useEffect(() => {
        if (!connectedDevice) return;

        const initializeBPCallbacks = async () => {
            try {
                // Set up BP-specific callbacks
                await wellueSDK.initialize({
                    onBPMeasurement: handleBPMeasurement,
                    onBPProgress: handleBPProgress,
                    onBPStatusChanged: handleBPStatusChanged,
                    onRealTimeUpdate: handleRealTimeUpdate,
                    onError: handleError
                });
            } catch (error) {
                console.error('Failed to initialize BP callbacks:', error);
                setBpState(prev => ({
                    ...prev,
                    status: { ...prev.status, error: 'Failed to initialize BP callbacks' }
                }));
            }
        };

        initializeBPCallbacks();
    }, [connectedDevice]);

    // SDK Event Handlers
    const handleBPMeasurement = useCallback(async (measurement: BPMeasurement) => {
        setBpState(prev => ({
            ...prev,
            status: { ...prev.status, lastMeasurement: measurement },
            history: [measurement, ...prev.history].slice(0, 10) // Keep last 10 measurements
        }));

        // Save to database for real-time doctor monitoring
        try {
            await addVitalSign('BP', {
                systolic: measurement.systolic,
                diastolic: measurement.diastolic,
                pulse: measurement.pulse,
                unit: 'mmHg',
                timestamp: new Date().toISOString()
            }, connectedDevice?.id);

            console.log('✅ BP measurement saved to database');
        } catch (error) {
            console.error('❌ Failed to save BP measurement to database:', error);
        }
    }, [addVitalSign, connectedDevice?.id]);

    const handleBPProgress = useCallback((progress: BPProgress) => {
        setBpState(prev => ({
            ...prev,
            status: { ...prev.status, currentPressure: progress.pressure }
        }));
    }, []);

    const handleBPStatusChanged = useCallback((status: BPStatus) => {
        setBpState(prev => ({
            ...prev,
            status
        }));
    }, []);

    const handleRealTimeUpdate = useCallback((data: RealTimeData) => {
        setBpState(prev => ({
            ...prev,
            realTimeData: data
        }));
    }, []);

    const handleError = useCallback((error: string, details?: any) => {
        console.error('BP Measurement Error:', error, details);
        setBpState(prev => ({
            ...prev,
            status: { ...prev.status, error }
        }));
    }, []);

    // BP Measurement Actions
    const startBPMeasurement = async () => {
        if (!connectedDevice) {
            setBpState(prev => ({
                ...prev,
                status: { ...prev.status, error: 'No device connected' }
            }));
            return;
        }

        try {
            await startBPFromContext();
            setBpState(prev => ({
                ...prev,
                status: { ...prev.status, error: undefined }
            }));
        } catch (error) {
            setBpState(prev => ({
                ...prev,
                status: { ...prev.status, error: `Failed to start BP measurement: ${error}` }
            }));
        }
    };

    const stopBPMeasurement = async () => {
        if (!connectedDevice) return;

        try {
            await stopMeasurementFromContext();
        } catch (error) {
            console.error('Failed to stop BP measurement:', error);
        }
    };

    const refreshBattery = async () => {
        if (!connectedDevice) return;

        try {
            await wellueSDK.getBatteryLevel(connectedDevice.id);
        } catch (error) {
            console.error('Failed to refresh battery:', error);
        }
    };

    // UI Helper Functions
    const getStatusColor = (status: BPStatus['status']) => {
        switch (status) {
            case 'idle': return 'bg-gray-100 text-gray-800';
            case 'starting': return 'bg-blue-100 text-blue-800';
            case 'inflating': return 'bg-yellow-100 text-yellow-800';
            case 'holding': return 'bg-orange-100 text-orange-800';
            case 'deflating': return 'bg-purple-100 text-purple-800';
            case 'analyzing': return 'bg-indigo-100 text-indigo-800';
            case 'complete': return 'bg-green-100 text-green-800';
            case 'error': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: BPStatus['status']) => {
        switch (status) {
            case 'idle': return <Clock className="h-4 w-4" />;
            case 'starting': return <Activity className="h-4 w-4" />;
            case 'inflating': return <Activity className="h-4 w-4" />;
            case 'holding': return <Activity className="h-4 w-4" />;
            case 'deflating': return <Activity className="h-4 w-4" />;
            case 'analyzing': return <Activity className="h-4 w-4" />;
            case 'complete': return <CheckCircle className="h-4 w-4" />;
            case 'error': return <AlertCircle className="h-4 w-4" />;
            default: return <Clock className="h-4 w-4" />;
        }
    };

    const formatPressure = (pressure: number) => {
        return `${pressure} mmHg`;
    };

    const formatQuality = (quality: BPMeasurement['quality']) => {
        switch (quality) {
            case 'good': return 'Good';
            case 'fair': return 'Fair';
            case 'poor': return 'Poor';
            default: return 'Unknown';
        }
    };

    // Show connection required message if no device
    if (!connectedDevice) {
        return (
            <div className="container mx-auto p-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Heart className="h-5 w-5" />
                            Live BP Monitor
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Alert>
                            <BluetoothOff className="h-4 w-4" />
                            <AlertDescription>
                                No device connected. Please connect a Wellue device from the scanner first.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Heart className="h-5 w-5" />
                        Live BP Monitor
                    </CardTitle>
                    <CardDescription>
                        Monitor blood pressure measurements in real-time
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Device Status */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <div>
                                <p className="font-medium">{connectedDevice.name}</p>
                                <p className="text-sm text-gray-500">Connected</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="flex items-center gap-1">
                                <Battery className="h-3 w-3" />
                                {connectedDevice.battery || 0}%
                            </Badge>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={refreshBattery}
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Bluetooth Status */}
                    <div className="flex items-center gap-2 mb-4">
                        {bluetoothEnabled ? (
                            <Bluetooth className="h-4 w-4 text-blue-500" />
                        ) : (
                            <BluetoothOff className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">
                            Bluetooth: {bluetoothEnabled ? "Enabled" : "Disabled"}
                        </span>
                    </div>

                    {/* Error Display */}
                    {(deviceError || bpState.status.error) && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                {deviceError || bpState.status.error}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* BP Measurement Controls */}
            <Card>
                <CardHeader>
                    <CardTitle>Measurement Controls</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        {!bpState.status.isMeasuring ? (
                            <Button
                                onClick={startBPMeasurement}
                                disabled={!bluetoothEnabled}
                                className="flex-1"
                            >
                                <Play className="h-4 w-4 mr-2" />
                                Start BP Measurement
                            </Button>
                        ) : (
                            <Button
                                onClick={stopBPMeasurement}
                                variant="outline"
                                className="flex-1"
                            >
                                <Square className="h-4 w-4 mr-2" />
                                Stop Measurement
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Current Status */}
            <Card>
                <CardHeader>
                    <CardTitle>Current Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                            {getStatusIcon(bpState.status.status)}
                            <Badge className={getStatusColor(bpState.status.status)}>
                                {bpState.status.status.charAt(0).toUpperCase() + bpState.status.status.slice(1)}
                            </Badge>
                        </div>

                        {/* Pressure Progress */}
                        {bpState.status.isMeasuring && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Current Pressure</span>
                                    <span className="font-medium">
                                        {formatPressure(bpState.status.currentPressure)}
                                    </span>
                                </div>
                                <Progress
                                    value={Math.min((bpState.status.currentPressure / 300) * 100, 100)}
                                    className="h-2"
                                />
                            </div>
                        )}

                        {/* Real-time Data */}
                        {bpState.realTimeData && (
                            <div className="space-y-2">
                                <h4 className="font-medium">Real-time Data</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>Heart Rate: {bpState.realTimeData.heartRate || 'N/A'} bpm</div>
                                    <div>Progress: {bpState.realTimeData.progress || 'N/A'}%</div>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Last Measurement */}
            {bpState.status.lastMeasurement && (
                <Card>
                    <CardHeader>
                        <CardTitle>Last Measurement</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">Systolic</p>
                                <p className="text-2xl font-bold text-red-600">
                                    {bpState.status.lastMeasurement.systolic} mmHg
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Diastolic</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {bpState.status.lastMeasurement.diastolic} mmHg
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Pulse</p>
                                <p className="text-xl font-semibold text-green-600">
                                    {bpState.status.lastMeasurement.pulseRate} bpm
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Quality</p>
                                <Badge variant="outline">
                                    {formatQuality(bpState.status.lastMeasurement.quality)}
                                </Badge>
                            </div>
                        </div>
                        <Separator className="my-4" />
                        <div className="text-sm text-gray-500">
                            <p>Date: {new Date(bpState.status.lastMeasurement.timestamp).toLocaleString()}</p>
                            <p>Device: {connectedDevice.name}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Measurement History */}
            {bpState.history.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Measurement History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {bpState.history.slice(0, 5).map((measurement, index) => (
                                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div>
                                        <p className="font-medium">
                                            {measurement.systolic}/{measurement.diastolic} mmHg
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            Pulse: {measurement.pulseRate} bpm • {new Date(measurement.timestamp).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <Badge variant="outline">
                                        {formatQuality(measurement.quality)}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default LiveBPMonitor; 