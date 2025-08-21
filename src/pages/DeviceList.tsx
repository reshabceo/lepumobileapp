import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wifi, WifiOff, Battery, Activity, Heart, Droplets, Wind, Settings, Info, Loader2, Bluetooth, Plus, BarChart3, Video, Camera, Shield } from 'lucide-react';
import { MobileAppContainer } from '@/components/MobileAppContainer';
import { useHealthData } from '@/hooks/useHealthData';
import { Device } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// Device type icons
const getDeviceIcon = (type: string) => {
    switch (type) {
        case 'BP':
            return Heart;
        case 'ECG':
            return Activity;
        case 'OXIMETER':
            return Wind;
        case 'GLUCOSE':
            return Droplets;
        default:
            return Activity;
    }
};

// Device type names
const getDeviceTypeName = (type: string) => {
    switch (type) {
        case 'BP':
            return 'Blood Pressure Monitor';
        case 'ECG':
            return 'ECG Monitor';
        case 'OXIMETER':
            return 'Pulse Oximeter';
        case 'GLUCOSE':
            return 'Blood Glucose Meter';
        default:
            return 'Medical Device';
    }
};

// Get battery color based on level
const getBatteryColor = (level?: number) => {
    if (!level) return '#6B7280';
    if (level > 50) return '#34D399';
    if (level > 20) return '#FCD34D';
    return '#F87171';
};

// Device Card Component
const DeviceCard = ({ device, onInfoClick }: { device: Device; onInfoClick: () => void }) => {
    const Icon = getDeviceIcon(device.type);
    const batteryColor = getBatteryColor(device.battery);
    const lastSeenDate = new Date(device.lastSeen);
    const timeAgo = Math.floor((Date.now() - lastSeenDate.getTime()) / (1000 * 60));

    return (
        <div className="bg-[#1E1E1E] rounded-2xl p-4 hover:bg-[#252525] transition-all duration-200">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${device.connected ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                        <Icon className={`h-6 w-6 ${device.connected ? 'text-green-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white text-lg">{device.name}</h3>
                        <p className="text-gray-400 text-sm">{getDeviceTypeName(device.type)}</p>
                        <p className="text-gray-500 text-xs">Model: {device.model}</p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1">
                        {device.connected ? (
                            <Wifi className="h-4 w-4 text-green-400" />
                        ) : (
                            <WifiOff className="h-4 w-4 text-gray-500" />
                        )}
                        <span className={`text-xs font-medium ${device.connected ? 'text-green-400' : 'text-gray-500'}`}>
                            {device.connected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                    {device.battery && (
                        <div className="flex items-center gap-1">
                            <Battery className="h-4 w-4" style={{ color: batteryColor }} />
                            <span className="text-xs" style={{ color: batteryColor }}>
                                {device.battery}%
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                    <p>Last seen: {timeAgo < 1 ? 'Just now' : `${timeAgo}m ago`}</p>
                    {device.connectedAtFormatted && (
                        <p className="text-green-400">Connected: {device.connectedAtFormatted}</p>
                    )}
                    {device.connectionDurationFormatted && (
                        <p className="text-blue-400">Duration: {device.connectionDurationFormatted}</p>
                    )}
                    {device.firmware && <p>Firmware: {device.firmware}</p>}
                </div>
                <button
                    onClick={onInfoClick}
                    className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 p-2 rounded-lg transition-all duration-200"
                >
                    <Info className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

const DeviceList = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { devices, loading, error } = useHealthData();
    
    // Camera settings state
    const [cameraSerialNumber, setCameraSerialNumber] = useState('');
    const [cameraPermissionEnabled, setCameraPermissionEnabled] = useState(false);

    const handleBack = () => {
        navigate('/dashboard');
    };

    const handleDeviceInfo = (device: Device) => {
        toast({
            title: "Device Details",
            description: `${device.name} (${device.model}) - MAC: ${device.macAddress}`,
        });
    };

    const connectedDevices = devices.filter(d => d.connected);
    const disconnectedDevices = devices.filter(d => !d.connected);

    if (loading) {
        return (
            <MobileAppContainer>
                <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-gray-400">Loading devices...</p>
                    </div>
                </div>
            </MobileAppContainer>
        );
    }

    if (error) {
        return (
            <MobileAppContainer>
                <div className="bg-[#101010] min-h-screen text-white p-4">
                    <div className="max-w-sm mx-auto">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
                            <WifiOff className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-red-400 mb-2">Connection Error</h2>
                            <p className="text-gray-300 mb-4">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all duration-200"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            </MobileAppContainer>
        );
    }

    return (
        <MobileAppContainer>
            <div className="bg-[#101010] min-h-screen text-white p-4 font-inter">
                <div className="max-w-sm mx-auto">
                    {/* Status Bar Spacing */}
                    <div className="h-6"></div>

                    {/* Header */}
                    <header className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleBack}
                                className="bg-gray-700/80 hover:bg-gray-600 p-2 rounded-lg transition-all duration-200"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="text-2xl font-bold">Device Settings</h1>
                        </div>
                        <button className="bg-gray-700/80 hover:bg-gray-600 p-2 rounded-lg transition-all duration-200">
                            <Settings size={20} />
                        </button>
                    </header>



                    {/* Wellue Scanner Section */}
                    <div className="mb-6">
                        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-500/20 p-3 rounded-full">
                                        <Bluetooth className="h-6 w-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Wellue BP2 Scanner</h3>
                                        <p className="text-sm text-gray-400">Official SDK for accurate readings</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate('/wellue-scanner')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
                                >
                                    <Bluetooth className="h-4 w-4" />
                                    Connect BP2
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Camera Settings Section */}
                    <div className="mb-6">
                        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-4">
                            <div className="mb-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-purple-500/20 p-3 rounded-full">
                                        <Video className="h-6 w-6 text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Camera Settings</h3>
                                        <p className="text-sm text-gray-400">Configure camera device and permissions</p>
                                    </div>
                                </div>
                                
                                {/* Serial Number Input */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Camera Serial Number
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Camera className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            value={cameraSerialNumber}
                                            onChange={(e) => setCameraSerialNumber(e.target.value)}
                                            placeholder="Enter camera serial number"
                                            className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                                        />
                                    </div>
                                </div>

                                {/* Camera Permission Toggle */}
                                <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-gray-600">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-purple-500/20 p-2 rounded-full">
                                            <Shield className="h-4 w-4 text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">Phone Camera Permission</p>
                                            <p className="text-xs text-gray-400">Allow access to device camera</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setCameraPermissionEnabled(!cameraPermissionEnabled);
                                            toast({
                                                title: cameraPermissionEnabled ? "Camera Permission Disabled" : "Camera Permission Enabled",
                                                description: cameraPermissionEnabled 
                                                    ? "Camera access has been revoked" 
                                                    : "Camera access has been granted",
                                            });
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                                            cameraPermissionEnabled ? 'bg-purple-600' : 'bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                                                cameraPermissionEnabled ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>





                    {/* Connected Devices */}
                    {connectedDevices.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-green-400 mb-3 flex items-center gap-2">
                                <Wifi className="h-5 w-5" />
                                Connected Devices ({connectedDevices.length})
                            </h2>
                            <div className="space-y-3">
                                {connectedDevices.map((device) => (
                                    <DeviceCard
                                        key={device.id}
                                        device={device}
                                        onInfoClick={() => handleDeviceInfo(device)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Disconnected Devices */}
                    {disconnectedDevices.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-gray-400 mb-3 flex items-center gap-2">
                                <WifiOff className="h-5 w-5" />
                                Offline Devices ({disconnectedDevices.length})
                            </h2>
                            <div className="space-y-3">
                                {disconnectedDevices.map((device) => (
                                    <DeviceCard
                                        key={device.id}
                                        device={device}
                                        onInfoClick={() => handleDeviceInfo(device)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}



                    <div className="pb-8"></div>
                </div>
            </div>
        </MobileAppContainer>
    );
};

export default DeviceList;