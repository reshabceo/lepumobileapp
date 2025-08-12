import React, { useState, useEffect } from 'react';
import { Play, Pause, Power, Heart, Activity, Zap, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeviceControl {
    id: string;
    name: string;
    connected: boolean;
    status: 'idle' | 'starting' | 'active' | 'measuring' | 'stopping' | 'error';
    currentMode?: 'bp' | 'ecg' | 'heart_rate' | 'none';
    battery?: number;
}

interface DeviceControlPanelProps {
    device: DeviceControl | null;
    onModeChange?: (mode: 'bp' | 'ecg' | 'heart_rate' | 'none') => void;
    onStartMeasurement?: () => void;
    onStopMeasurement?: () => void;
    onDeviceActivation?: (activate: boolean) => void;
}

export const DeviceControlPanel: React.FC<DeviceControlPanelProps> = ({
    device,
    onModeChange,
    onStartMeasurement,
    onStopMeasurement,
    onDeviceActivation
}) => {
    const [isActivated, setIsActivated] = useState(false);
    const [currentMode, setCurrentMode] = useState<'bp' | 'ecg' | 'heart_rate' | 'none'>('none');
    const [buttonPressed, setButtonPressed] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (device) {
            setCurrentMode(device.currentMode || 'none');
        }
    }, [device]);

    // Simulate button press detection
    useEffect(() => {
        if (!device || !device.connected) return;

        const handleKeyPress = (event: KeyboardEvent) => {
            // Simulate device button presses with keyboard
            switch (event.key) {
                case '1':
                    handleButtonPress('start_bp');
                    break;
                case '2':
                    handleButtonPress('start_ecg');
                    break;
                case '3':
                    handleButtonPress('start_heart_rate');
                    break;
                case ' ':
                    handleButtonPress('stop_measurement');
                    break;
                case 'Enter':
                    handleButtonPress('device_power');
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [device]);

    const handleButtonPress = (button: string) => {
        setButtonPressed(button);
        
        // Simulate button press feedback
        setTimeout(() => setButtonPressed(null), 200);

        switch (button) {
            case 'start_bp':
                startBPMeasurement();
                break;
            case 'start_ecg':
                startECGMeasurement();
                break;
            case 'start_heart_rate':
                startHeartRateMeasurement();
                break;
            case 'stop_measurement':
                stopMeasurement();
                break;
            case 'device_power':
                toggleDeviceActivation();
                break;
        }
    };

    const startBPMeasurement = async () => {
        if (!device || !device.connected) {
            toast({
                title: "Device Not Connected",
                description: "Please connect your BP2 device first.",
                variant: "destructive",
            });
            return;
        }

        try {
            setCurrentMode('bp');
            if (onModeChange) onModeChange('bp');
            if (onStartMeasurement) onStartMeasurement();

            toast({
                title: "Starting BP Measurement",
                description: "Blood pressure measurement is starting...",
            });

            // Simulate device activation
            await activateDeviceMode('bp');
            
        } catch (error) {
            toast({
                title: "Measurement Failed",
                description: "Failed to start BP measurement. Please try again.",
                variant: "destructive",
            });
        }
    };

    const startECGMeasurement = async () => {
        if (!device || !device.connected) {
            toast({
                title: "Device Not Connected",
                description: "Please connect your BP2 device first.",
                variant: "destructive",
            });
            return;
        }

        try {
            setCurrentMode('ecg');
            if (onModeChange) onModeChange('ecg');
            if (onStartMeasurement) onStartMeasurement();

            toast({
                title: "Starting ECG Measurement",
                description: "ECG measurement is starting...",
            });

            // Simulate device activation
            await activateDeviceMode('ecg');
            
        } catch (error) {
            toast({
                title: "Measurement Failed",
                description: "Failed to start ECG measurement. Please try again.",
                variant: "destructive",
            });
        }
    };

    const startHeartRateMeasurement = async () => {
        if (!device || !device.connected) {
            toast({
                title: "Device Not Connected",
                description: "Please connect your BP2 device first.",
                variant: "destructive",
            });
            return;
        }

        try {
            setCurrentMode('heart_rate');
            if (onModeChange) onModeChange('heart_rate');
            if (onStartMeasurement) onStartMeasurement();

            toast({
                title: "Starting Heart Rate Measurement",
                description: "Heart rate measurement is starting...",
            });

            // Simulate device activation
            await activateDeviceMode('heart_rate');
            
        } catch (error) {
            toast({
                title: "Measurement Failed",
                description: "Failed to start heart rate measurement. Please try again.",
                variant: "destructive",
            });
        }
    };

    const stopMeasurement = async () => {
        if (!device) return;

        try {
            setCurrentMode('none');
            if (onModeChange) onModeChange('none');
            if (onStopMeasurement) onStopMeasurement();

            toast({
                title: "Stopping Measurement",
                description: "Measurement is being stopped...",
            });

            // Simulate device deactivation
            await deactivateDevice();
            
        } catch (error) {
            toast({
                title: "Stop Failed",
                description: "Failed to stop measurement. Please try again.",
                variant: "destructive",
            });
        }
    };

    const toggleDeviceActivation = async () => {
        if (!device) return;

        if (isActivated) {
            await deactivateDevice();
        } else {
            await activateDevice();
        }
    };

    const activateDevice = async () => {
        try {
            setIsActivated(true);
            if (onDeviceActivation) onDeviceActivation(true);

            toast({
                title: "Device Activated",
                description: "BP2 device is now active and ready for measurements.",
            });
        } catch (error) {
            toast({
                title: "Activation Failed",
                description: "Failed to activate device. Please check connection.",
                variant: "destructive",
            });
        }
    };

    const deactivateDevice = async () => {
        try {
            setIsActivated(false);
            setCurrentMode('none');
            if (onDeviceActivation) onDeviceActivation(false);
            if (onModeChange) onModeChange('none');

            toast({
                title: "Device Deactivated",
                description: "BP2 device has been deactivated.",
            });
        } catch (error) {
            toast({
                title: "Deactivation Failed",
                description: "Failed to deactivate device. Please try again.",
                variant: "destructive",
            });
        }
    };

    const activateDeviceMode = async (mode: string) => {
        // Simulate sending command to device
        console.log(`Activating device mode: ${mode}`);
        
        // In real implementation, this would send the appropriate command to the device
        // For now, we'll simulate the process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast({
            title: "Device Mode Activated",
            description: `${mode.toUpperCase()} mode is now active on your BP2 device.`,
        });
    };

    const getStatusColor = () => {
        switch (device?.status) {
            case 'active': return 'text-green-400';
            case 'measuring': return 'text-blue-400';
            case 'starting': return 'text-yellow-400';
            case 'stopping': return 'text-orange-400';
            case 'error': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getModeIcon = () => {
        switch (currentMode) {
            case 'bp': return <Heart className="w-5 h-5 text-red-400" />;
            case 'ecg': return <Activity className="w-5 h-5 text-green-400" />;
            case 'heart_rate': return <Heart className="w-5 h-5 text-blue-400" />;
            default: return <Settings className="w-5 h-5 text-gray-400" />;
        }
    };

    if (!device) {
        return (
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <div className="text-center">
                    <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-400 mb-2">No Device Connected</h3>
                    <p className="text-sm text-gray-500">
                        Connect your Wellue BP2 device to access control panel
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            {/* Device Status */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    {getModeIcon()}
                    <div>
                        <h3 className="text-lg font-semibold text-white">Device Control</h3>
                        <p className={`text-sm ${getStatusColor()}`}>
                            {device.status === 'active' && 'Device Active'}
                            {device.status === 'measuring' && 'Taking Measurement'}
                            {device.status === 'starting' && 'Starting...'}
                            {device.status === 'stopping' && 'Stopping...'}
                            {device.status === 'error' && 'Error'}
                            {device.status === 'idle' && 'Idle'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isActivated ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    <span className="text-sm text-gray-400">
                        {isActivated ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>

            {/* Control Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                {/* BP Measurement */}
                <button
                    onClick={() => handleButtonPress('start_bp')}
                    disabled={!device.connected || !isActivated}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                        buttonPressed === 'start_bp' 
                            ? 'border-blue-400 bg-blue-500/20' 
                            : currentMode === 'bp'
                            ? 'border-red-400 bg-red-500/20 text-red-400'
                            : 'border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white'
                    } ${(!device.connected || !isActivated) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Heart className="w-6 h-6" />
                    <span className="font-medium">Blood Pressure</span>
                    <span className="text-xs">Press '1'</span>
                </button>

                {/* ECG Measurement */}
                <button
                    onClick={() => handleButtonPress('start_ecg')}
                    disabled={!device.connected || !isActivated}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                        buttonPressed === 'start_ecg' 
                            ? 'border-blue-400 bg-blue-500/20' 
                            : currentMode === 'ecg'
                            ? 'border-green-400 bg-green-500/20 text-green-400'
                            : 'border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white'
                    } ${(!device.connected || !isActivated) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Activity className="w-6 h-6" />
                    <span className="font-medium">ECG</span>
                    <span className="text-xs">Press '2'</span>
                </button>

                {/* Heart Rate */}
                <button
                    onClick={() => handleButtonPress('start_heart_rate')}
                    disabled={!device.connected || !isActivated}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                        buttonPressed === 'start_heart_rate' 
                            ? 'border-blue-400 bg-blue-500/20' 
                            : currentMode === 'heart_rate'
                            ? 'border-blue-400 bg-blue-500/20 text-blue-400'
                            : 'border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white'
                    } ${(!device.connected || !isActivated) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Heart className="w-6 h-6" />
                    <span className="font-medium">Heart Rate</span>
                    <span className="text-xs">Press '3'</span>
                </button>

                {/* Stop Measurement */}
                <button
                    onClick={() => handleButtonPress('stop_measurement')}
                    disabled={!device.connected || currentMode === 'none'}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                        buttonPressed === 'stop_measurement' 
                            ? 'border-red-400 bg-red-500/20' 
                            : 'border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white'
                    } ${(!device.connected || currentMode === 'none') ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Pause className="w-6 h-6" />
                    <span className="font-medium">Stop</span>
                    <span className="text-xs">Press 'Space'</span>
                </button>
            </div>

            {/* Device Power Control */}
            <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Power className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-300">Device Power</span>
                    </div>
                    <button
                        onClick={() => handleButtonPress('device_power')}
                        disabled={!device.connected}
                        className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                            isActivated 
                                ? 'bg-red-600 hover:bg-red-700 text-white' 
                                : 'bg-green-600 hover:bg-green-700 text-white'
                        } ${!device.connected ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isActivated ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {isActivated ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Press 'Enter' to toggle device activation
                </p>
            </div>

            {/* Instructions */}
            <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-400 mb-2">Keyboard Shortcuts</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                    <div>• Press <kbd className="px-1 py-0.5 bg-gray-700 rounded">1</kbd> - Start BP</div>
                    <div>• Press <kbd className="px-1 py-0.5 bg-gray-700 rounded">2</kbd> - Start ECG</div>
                    <div>• Press <kbd className="px-1 py-0.5 bg-gray-700 rounded">3</kbd> - Start Heart Rate</div>
                    <div>• Press <kbd className="px-1 py-0.5 bg-gray-700 rounded">Space</kbd> - Stop</div>
                    <div>• Press <kbd className="px-1 py-0.5 bg-gray-700 rounded">Enter</kbd> - Toggle Power</div>
                </div>
            </div>
        </div>
    );
};
