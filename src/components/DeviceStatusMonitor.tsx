import React, { useState, useEffect } from 'react';
import { Heart, Battery, Wifi, WifiOff, AlertCircle, CheckCircle, Activity, Zap } from 'lucide-react';

interface DeviceStatus {
    id: string;
    name: string;
    connected: boolean;
    battery?: number;
    lastSeen: string;
    model?: string;
    type?: string;
    status: 'offline' | 'online' | 'measuring' | 'error';
    isCharging?: boolean;
    signalStrength?: number;
}

interface DeviceStatusMonitorProps {
    device: DeviceStatus | null;
    onStatusChange?: (status: DeviceStatus) => void;
}

export const DeviceStatusMonitor: React.FC<DeviceStatusMonitorProps> = ({ 
    device, 
    onStatusChange 
}) => {
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    useEffect(() => {
        if (device) {
            setLastUpdate(new Date());
        }
    }, [device]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (device && device.connected) {
                // Simulate battery drain and signal strength changes
                const updatedDevice = {
                    ...device,
                    battery: device.battery ? Math.max(0, device.battery - 0.1) : device.battery,
                    signalStrength: device.signalStrength ? Math.max(0, device.signalStrength - 0.5) : device.signalStrength
                };
                
                if (onStatusChange) {
                    onStatusChange(updatedDevice);
                }
            }
        }, 30000); // Update every 30 seconds

        return () => clearInterval(interval);
    }, [device, onStatusChange]);

    if (!device) {
        return (
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-3">
                    <WifiOff className="w-6 h-6 text-gray-400" />
                    <div>
                        <h3 className="text-lg font-semibold text-gray-400">No Device Connected</h3>
                        <p className="text-sm text-gray-500">Connect your Wellue BP2 device to start monitoring</p>
                    </div>
                </div>
            </div>
        );
    }

    const getStatusColor = () => {
        switch (device.status) {
            case 'online': return 'text-green-400';
            case 'measuring': return 'text-blue-400';
            case 'error': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getStatusIcon = () => {
        switch (device.status) {
            case 'online': return <CheckCircle className="w-6 h-6 text-green-400" />;
            case 'measuring': return <Activity className="w-6 h-6 text-blue-400 animate-pulse" />;
            case 'error': return <AlertCircle className="w-6 h-6 text-red-400" />;
            default: return <WifiOff className="w-6 h-6 text-gray-400" />;
        }
    };

    const getBatteryColor = () => {
        if (!device.battery) return 'text-gray-400';
        if (device.battery > 50) return 'text-green-400';
        if (device.battery > 20) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getSignalColor = () => {
        if (!device.signalStrength) return 'text-gray-400';
        if (device.signalStrength > 70) return 'text-green-400';
        if (device.signalStrength > 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getSignalStrength = () => {
        if (!device.signalStrength) return 'Unknown';
        if (device.signalStrength > 80) return 'Excellent';
        if (device.signalStrength > 60) return 'Good';
        if (device.signalStrength > 40) return 'Fair';
        return 'Poor';
    };

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            {/* Device Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    {getStatusIcon()}
                    <div>
                        <h3 className="text-lg font-semibold text-white">{device.name}</h3>
                        <p className={`text-sm ${getStatusColor()}`}>
                            {device.status === 'online' && 'Connected and Ready'}
                            {device.status === 'measuring' && 'Taking Measurement...'}
                            {device.status === 'error' && 'Connection Error'}
                            {device.status === 'offline' && 'Disconnected'}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500">
                        Last update: {lastUpdate.toLocaleTimeString()}
                    </p>
                </div>
            </div>

            {/* Device Details Grid */}
            <div className="grid grid-cols-2 gap-4">
                {/* Battery Status */}
                <div className="bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Battery className={`w-4 h-4 ${getBatteryColor()}`} />
                        <span className="text-sm font-medium text-gray-300">Battery</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${getBatteryColor()}`}>
                            {device.battery ? `${Math.round(device.battery)}%` : 'Unknown'}
                        </span>
                        {device.isCharging && <Zap className="w-4 h-4 text-yellow-400" />}
                    </div>
                    {device.battery && (
                        <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                            <div 
                                className={`h-2 rounded-full transition-all duration-300 ${
                                    device.battery > 50 ? 'bg-green-500' : 
                                    device.battery > 20 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${device.battery}%` }}
                            ></div>
                        </div>
                    )}
                </div>

                {/* Signal Strength */}
                <div className="bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Wifi className={`w-4 h-4 ${getSignalColor()}`} />
                        <span className="text-sm font-medium text-gray-300">Signal</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${getSignalColor()}`}>
                            {getSignalStrength()}
                        </span>
                    </div>
                    {device.signalStrength && (
                        <div className="flex gap-1 mt-2">
                            {[1, 2, 3, 4].map((bar) => (
                                <div
                                    key={bar}
                                    className={`h-3 rounded-sm transition-all duration-300 ${
                                        device.signalStrength! >= bar * 25 
                                            ? (device.signalStrength! > 50 ? 'bg-green-500' : 'bg-yellow-500')
                                            : 'bg-gray-600'
                                    }`}
                                    style={{ width: '4px' }}
                                ></div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Device Model */}
                <div className="bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Heart className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-medium text-gray-300">Model</span>
                    </div>
                    <span className="text-lg font-bold text-white">
                        {device.model || 'Unknown'}
                    </span>
                </div>

                {/* Connection Time */}
                <div className="bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium text-gray-300">Connected</span>
                    </div>
                    <span className="text-lg font-bold text-white">
                        {new Date(device.lastSeen).toLocaleTimeString()}
                    </span>
                </div>
            </div>

            {/* Status Messages */}
            {device.status === 'measuring' && (
                <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
                        <span className="text-sm text-blue-400 font-medium">
                            Device is currently taking a measurement. Please wait...
                        </span>
                    </div>
                </div>
            )}

            {device.status === 'error' && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-400 font-medium">
                            Connection error detected. Please check device connection.
                        </span>
                    </div>
                </div>
            )}

            {device.battery && device.battery < 20 && (
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                        <Battery className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-yellow-400 font-medium">
                            Low battery warning: {Math.round(device.battery)}% remaining
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
