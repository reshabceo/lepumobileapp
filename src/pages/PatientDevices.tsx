import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Settings, Trash2, Wifi, WifiOff, Battery, Clock, Info, AlertTriangle, Loader2, Heart, Activity, Wind, Droplets } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { MobileAppContainer } from '@/components/MobileAppContainer';
import { useQuery } from '@tanstack/react-query';

// Define interfaces locally since we're not using the old API service
export interface Device {
    id: string;
    name: string;
    model: string;
    macAddress: string;
    type: 'BP' | 'ECG' | 'OXIMETER' | 'GLUCOSE';
    connected: boolean;
    lastSeen: string;
    battery?: number;
    firmware?: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

// Get device type info
const getDeviceTypeInfo = (type: string) => {
    switch (type) {
        case 'BP':
            return {
                icon: Heart,
                color: 'text-red-400',
                bgColor: 'bg-red-500/20',
                label: 'Blood Pressure'
            };
        case 'ECG':
            return {
                icon: Activity,
                color: 'text-green-400',
                bgColor: 'bg-green-500/20',
                label: 'ECG Monitor'
            };
        case 'OXIMETER':
            return {
                icon: Wind,
                color: 'text-blue-400',
                bgColor: 'bg-blue-500/20',
                label: 'Pulse Oximeter'
            };
        case 'GLUCOSE':
            return {
                icon: Droplets,
                color: 'text-yellow-400',
                bgColor: 'bg-yellow-500/20',
                label: 'Glucose Monitor'
            };
        default:
            return {
                icon: Activity,
                color: 'text-gray-400',
                bgColor: 'bg-gray-500/20',
                label: 'Unknown Device'
            };
    }
};

// Get battery status color
const getBatteryColor = (level: number) => {
    if (level > 50) return 'text-green-400';
    if (level > 20) return 'text-yellow-400';
    return 'text-red-400';
};

// Device Card Component
const PatientDeviceCard = ({ device, onInfoClick }: { device: Device; onInfoClick: () => void }) => {
    const deviceInfo = getDeviceTypeInfo(device.type);
    const Icon = deviceInfo.icon;
    const batteryColor = getBatteryColor(device.battery || 0);
    const lastSeenDate = new Date(device.lastSeen);
    const timeAgo = Math.floor((Date.now() - lastSeenDate.getTime()) / (1000 * 60));

    return (
        <div className="bg-[#1E1E1E] rounded-2xl p-5 hover:bg-[#252525] transition-all duration-200 border border-gray-700/50">
            {/* Device Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${device.connected ? deviceInfo.bgColor : 'bg-gray-500/20'}`}>
                        <Icon className={`h-6 w-6 ${device.connected ? deviceInfo.color : 'text-gray-500'}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">{device.name}</h3>
                        <p className="text-gray-400 text-sm">{deviceInfo.label}</p>
                        <p className="text-gray-500 text-xs">Model: {device.model}</p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1">
                        {device.connected ? (
                            <Wifi className="h-4 w-4 text-green-400" />
                        ) : (
                            <WifiOff className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-xs font-medium ${device.connected ? 'text-green-400' : 'text-red-500'}`}>
                            {device.connected ? 'Online' : 'Offline'}
                        </span>
                    </div>
                    {device.battery && (
                        <div className="flex items-center gap-1">
                            <Battery className={`h-4 w-4 ${batteryColor}`} />
                            <span className={`text-xs ${batteryColor}`}>
                                {device.battery}%
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Device Status */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-[#2A2A2A] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-400">Last Seen</span>
                    </div>
                    <div className="text-sm text-white">
                        {timeAgo < 1 ? 'Just now' : `${timeAgo}m ago`}
                    </div>
                </div>
                <div className="bg-[#2A2A2A] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Settings className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-400">Firmware</span>
                    </div>
                    <div className="text-sm text-white">
                        {device.firmware || 'N/A'}
                    </div>
                </div>
            </div>

            {/* MAC Address and Actions */}
            <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                    MAC: {device.macAddress}
                </div>
                <button
                    onClick={onInfoClick}
                    className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 p-2 rounded-lg transition-all duration-200"
                >
                    <Info className="h-4 w-4" />
                </button>
            </div>

            {/* Alert for low battery or disconnected */}
            {(!device.connected || (device.battery && device.battery < 20)) && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-400">
                        {!device.connected ? 'Device is offline' : 'Low battery - needs charging'}
                    </span>
                </div>
            )}
        </div>
    );
};

const PatientDevices = () => {
    const navigate = useNavigate();
    const { patientId } = useParams<{ patientId: string }>();
    const { toast } = useToast();

    // Fetch patient data with devices
    const { data: patientData, isLoading, error } = useQuery({
        queryKey: ['patient', patientId],
        queryFn: () => patientId ? apiService.getPatient(patientId) : Promise.reject('No patient ID'),
        refetchInterval: 10000, // Refresh every 10 seconds for real-time updates
    });

    const handleBack = () => {
        navigate('/patients');
    };

    const handleDeviceInfo = (device: Device) => {
        toast({
            title: "Device Details",
            description: `${device.name} (${device.model}) - MAC: ${device.macAddress}`,
        });
    };

    if (isLoading) {
        return (
            <MobileAppContainer>
                <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-gray-400">Loading patient devices...</p>
                    </div>
                </div>
            </MobileAppContainer>
        );
    }

    if (error || !patientData?.patient) {
        return (
            <MobileAppContainer>
                <div className="bg-[#101010] min-h-screen text-white p-4">
                    <div className="max-w-sm mx-auto">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
                            <User className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-red-400 mb-2">Patient Not Found</h2>
                            <p className="text-gray-300 mb-4">
                                {error instanceof Error ? error.message : 'Failed to load patient data'}
                            </p>
                            <button
                                onClick={handleBack}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-all duration-200"
                            >
                                Back to Patients
                            </button>
                        </div>
                    </div>
                </div>
            </MobileAppContainer>
        );
    }

    const patient = patientData.patient;
    const devices = patient.devices || [];
    const connectedDevices = devices.filter(d => d.connected);
    const avgBattery = devices.reduce((sum, d) => sum + (d.battery || 0), 0) / devices.length;

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
                            <div>
                                <h1 className="text-xl font-bold">{patient.name}</h1>
                                <p className="text-sm text-gray-400">Patient Devices</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => navigate(`/patient/${patientId}/monitor`)}
                                className="bg-green-500/80 hover:bg-green-600 p-2 rounded-lg transition-all duration-200"
                                title="Live Monitor"
                            >
                                <Monitor size={20} />
                            </button>
                            <button className="bg-gray-700/80 hover:bg-gray-600 p-2 rounded-lg transition-all duration-200">
                                <Settings size={20} />
                            </button>
                        </div>
                    </header>

                    {/* Patient Info Card */}
                    <div className="bg-[#1E1E1E] rounded-2xl p-5 mb-6 border border-gray-700/50">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-blue-500/20 p-3 rounded-full">
                                <User className="h-8 w-8 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-white text-lg">{patient.name}</h2>
                                <p className="text-gray-400 text-sm">Age: {patient.age} years</p>
                                <p className="text-gray-500 text-xs">{patient.condition}</p>
                            </div>
                        </div>

                        {/* Device Statistics */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                                <div className="text-xl font-bold text-green-400">{connectedDevices.length}/{devices.length}</div>
                                <div className="text-xs text-gray-400">Connected</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-bold text-blue-400">{Math.round(avgBattery)}%</div>
                                <div className="text-xs text-gray-400">Avg Battery</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-bold text-white">{devices.length}</div>
                                <div className="text-xs text-gray-400">Total Devices</div>
                            </div>
                        </div>
                    </div>

                    {/* Devices List */}
                    <div className="space-y-4 mb-8">
                        <h2 className="text-lg font-bold text-white mb-3">
                            Medical Devices ({devices.length})
                        </h2>

                        {devices.length > 0 ? (
                            devices.map((device) => (
                                <PatientDeviceCard
                                    key={device.id}
                                    device={device}
                                    onInfoClick={() => handleDeviceInfo(device)}
                                />
                            ))
                        ) : (
                            <div className="bg-[#1E1E1E] rounded-2xl p-8 text-center">
                                <Activity className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-400 mb-2">No Devices Found</h3>
                                <p className="text-sm text-gray-500">
                                    No medical devices are assigned to this patient
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="pb-8"></div>
                </div>
            </div>
        </MobileAppContainer>
    );
};

export default PatientDevices;