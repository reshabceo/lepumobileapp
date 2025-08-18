import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, Activity, Heart, Droplets, Wind, Settings, Loader2, Wifi, WifiOff, Battery, TrendingUp, AlertCircle, Wrench } from 'lucide-react';
import { MobileAppContainer } from '@/components/MobileAppContainer';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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

export interface Measurement {
    id: string;
    deviceId: string;
    timestamp: string;
    type: string;
    [key: string]: any;
}

// Get device type info with colors
const getDeviceInfo = (type: string) => {
    switch (type) {
        case 'BP':
            return {
                icon: Heart,
                color: 'text-red-400',
                bgColor: 'bg-red-500/20',
                name: 'Blood Pressure',
                primaryColor: '#f87171',
                secondaryColor: '#fca5a5'
            };
        case 'ECG':
            return {
                icon: Activity,
                color: 'text-green-400',
                bgColor: 'bg-green-500/20',
                name: 'Heart Rate',
                primaryColor: '#34d399'
            };
        case 'OXIMETER':
            return {
                icon: Wind,
                color: 'text-blue-400',
                bgColor: 'bg-blue-500/20',
                name: 'Oxygen Level',
                primaryColor: '#60a5fa'
            };
        case 'GLUCOSE':
            return {
                icon: Droplets,
                color: 'text-yellow-400',
                bgColor: 'bg-yellow-500/20',
                name: 'Blood Sugar',
                primaryColor: '#fbbf24'
            };
        default:
            return {
                icon: Activity,
                color: 'text-gray-400',
                bgColor: 'bg-gray-500/20',
                name: 'Unknown',
                primaryColor: '#9ca3af'
            };
    }
};

// Get status color and text based on values
const getVitalStatus = (type: string, value: any) => {
    switch (type) {
        case 'BP':
            const systolic = typeof value === 'object' ? value.systolic : parseInt(String(value).split('/')[0]);
            if (systolic >= 140) return { status: 'High', color: 'text-red-400', bgColor: 'bg-red-500/20' };
            if (systolic < 90) return { status: 'Low', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
            return { status: 'Normal', color: 'text-green-400', bgColor: 'bg-green-500/20' };

        case 'ECG':
            const hr = typeof value === 'object' ? value.heartRate : parseInt(String(value));
            if (hr > 100) return { status: 'High', color: 'text-red-400', bgColor: 'bg-red-500/20' };
            if (hr < 60) return { status: 'Low', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
            return { status: 'Normal', color: 'text-green-400', bgColor: 'bg-green-500/20' };

        case 'OXIMETER':
            const spo2 = typeof value === 'object' ? value.spo2 : parseInt(String(value));
            if (spo2 < 90) return { status: 'Critical', color: 'text-red-500', bgColor: 'bg-red-500/20' };
            if (spo2 < 95) return { status: 'Low', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
            return { status: 'Normal', color: 'text-green-400', bgColor: 'bg-green-500/20' };

        case 'GLUCOSE':
            const glucose = typeof value === 'object' ? value.value : parseInt(String(value));
            if (glucose > 180) return { status: 'High', color: 'text-red-400', bgColor: 'bg-red-500/20' };
            if (glucose < 70) return { status: 'Low', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
            return { status: 'Normal', color: 'text-green-400', bgColor: 'bg-green-500/20' };

        default:
            return { status: 'Unknown', color: 'text-gray-400', bgColor: 'bg-gray-500/20' };
    }
};

// Format chart data for different device types
const formatChartData = (measurements: Measurement[], deviceType: string) => {
    if (!measurements || measurements.length === 0) return [];

    return measurements.slice(-20).map((measurement, index) => {
        const time = new Date(measurement.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });

        switch (deviceType) {
            case 'BP':
                return {
                    time,
                    systolic: measurement.systolic || 0,
                    diastolic: measurement.diastolic || 0,
                    index
                };
            case 'ECG':
                return {
                    time,
                    heartRate: measurement.heartRate || 0,
                    index
                };
            case 'OXIMETER':
                return {
                    time,
                    spo2: measurement.spo2 || 0,
                    pulseRate: measurement.pulseRate || 0,
                    index
                };
            case 'GLUCOSE':
                return {
                    time,
                    glucose: measurement.value || 0,
                    index
                };
            default:
                return { time, value: 0, index };
        }
    });
};

// Real-time Vital Card Component
const VitalCard = ({ device, measurements }: { device: Device; measurements: Measurement[] }) => {
    const deviceInfo = getDeviceInfo(device.type);
    const Icon = deviceInfo.icon;
    const latestMeasurement = measurements[0];
    const chartData = formatChartData(measurements, device.type);

    if (!latestMeasurement) {
        return (
            <div className="bg-[#1E1E1E] rounded-2xl p-5 border border-gray-700/50">
                <div className="flex items-center gap-3 mb-4">
                    <div className={deviceInfo.bgColor + ' p-3 rounded-full'}>
                        <Icon className={`h-6 w-6 ${deviceInfo.color}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">{deviceInfo.name}</h3>
                        <p className="text-gray-400 text-sm">No data available</p>
                    </div>
                </div>
            </div>
        );
    }

    let displayValue = '';
    let unit = '';
    let vitalStatus = { status: 'Unknown', color: 'text-gray-400', bgColor: 'bg-gray-500/20' };

    switch (device.type) {
        case 'BP':
            displayValue = `${latestMeasurement.systolic}/${latestMeasurement.diastolic}`;
            unit = 'mmHg';
            vitalStatus = getVitalStatus('BP', latestMeasurement);
            break;
        case 'ECG':
            displayValue = String(latestMeasurement.heartRate || 0);
            unit = 'bpm';
            vitalStatus = getVitalStatus('ECG', latestMeasurement);
            break;
        case 'OXIMETER':
            displayValue = String(latestMeasurement.spo2 || 0);
            unit = 'SpO2';
            vitalStatus = getVitalStatus('OXIMETER', latestMeasurement);
            break;
        case 'GLUCOSE':
            displayValue = String(latestMeasurement.value || 0);
            unit = 'mg/dL';
            vitalStatus = getVitalStatus('GLUCOSE', latestMeasurement);
            break;
    }

    return (
        <div className="bg-[#1E1E1E] rounded-2xl p-5 border border-gray-700/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={deviceInfo.bgColor + ' p-3 rounded-full'}>
                        <Icon className={`h-6 w-6 ${deviceInfo.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate">{deviceInfo.name}</h3>
                        <p className="text-gray-400 text-sm truncate">{device.name}</p>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${vitalStatus.bgColor} ${vitalStatus.color} border border-current/30 whitespace-nowrap flex-shrink-0`}>
                    {vitalStatus.status}
                </div>
            </div>

            {/* Current Value */}
            <div className="mb-4">
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">{displayValue}</span>
                    <span className="text-gray-400 text-sm">{unit}</span>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                    Last updated: {new Date(latestMeasurement.timestamp).toLocaleTimeString()}
                </p>
            </div>

            {/* BP Value Indicator - 5 squares adjusted by BP reading */}
            {device.type === 'BP' && (
                <div className="mb-4">
                    <div className="flex gap-2 h-4">
                        {(() => {
                            const systolic = latestMeasurement.systolic || 120;
                            const diastolic = latestMeasurement.diastolic || 80;

                            // More precise BP level calculation based on actual BP ranges
                            let bpLevel = 0;
                            if (systolic < 90) bpLevel = 0; // Low
                            else if (systolic < 120) bpLevel = 1; // Normal-low
                            else if (systolic < 130) bpLevel = 2; // Normal
                            else if (systolic < 140) bpLevel = 3; // Normal-high
                            else bpLevel = 4; // High

                            // Calculate individual square intensity based on exact BP value
                            const getSquareIntensity = (index: number) => {
                                if (index > bpLevel) return 0;
                                if (index < bpLevel) return 1;

                                // For the current level, calculate partial fill based on exact value
                                const ranges = [90, 120, 130, 140, 180];
                                const currentRange = ranges[index];
                                const prevRange = index > 0 ? ranges[index - 1] : 0;
                                const rangeSize = currentRange - prevRange;
                                const valueInRange = systolic - prevRange;
                                return Math.min(1, Math.max(0, valueInRange / rangeSize));
                            };

                            return Array.from({ length: 5 }, (_, index) => {
                                const intensity = getSquareIntensity(index);
                                const isActive = intensity > 0;

                                return (
                                    <div
                                        key={index}
                                        className={`flex-1 rounded-lg transition-all duration-300 ease-out ${isActive
                                            ? 'bg-green-400 shadow-lg shadow-green-400/30'
                                            : 'bg-gray-700/60'
                                            }`}
                                        style={{
                                            opacity: isActive ? 0.3 + (intensity * 0.7) : 0.3,
                                            transform: isActive ? 'scaleY(1)' : 'scaleY(0.8)',
                                            border: isActive ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(75, 85, 99, 0.3)',
                                            boxShadow: isActive ? '0 2px 8px rgba(74, 222, 128, 0.2)' : 'none'
                                        }}
                                    />
                                );
                            });
                        })()}
                    </div>
                </div>
            )}

            {/* Simple Real-time Chart */}
            <div className="h-16 bg-[#2A2A2A] rounded-lg p-2 relative overflow-hidden">
                <div className="flex items-end h-full gap-1">
                    {chartData.slice(-12).map((data, index) => {
                        const getValue = () => {
                            switch (device.type) {
                                case 'BP': return data.systolic;
                                case 'ECG': return data.heartRate;
                                case 'OXIMETER': return data.spo2;
                                case 'GLUCOSE': return data.glucose;
                                default: return 0;
                            }
                        };

                        const maxValue = device.type === 'BP' ? 180 : device.type === 'ECG' ? 120 : device.type === 'OXIMETER' ? 100 : 200;
                        const height = Math.max(10, (getValue() / maxValue) * 100);

                        return (
                            <div
                                key={index}
                                className="flex-1 rounded-sm animate-pulse"
                                style={{
                                    height: `${height}%`,
                                    backgroundColor: deviceInfo.primaryColor,
                                    opacity: index === chartData.length - 1 ? 1 : 0.6 + (index * 0.05)
                                }}
                            />
                        );
                    })}
                </div>

                {/* Real-time pulse animation */}
                <div
                    className="absolute top-0 right-0 w-1 h-full animate-pulse"
                    style={{ backgroundColor: deviceInfo.primaryColor, opacity: 0.8 }}
                />

                {/* Trend line overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-30"
                    style={{ color: deviceInfo.primaryColor }} />
            </div>

            {/* Trend indicator */}
            <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <TrendingUp className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span className="text-xs text-green-400 truncate">Trending stable</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {device.connected ? (
                        <Wifi className="h-3 w-3 text-green-400" />
                    ) : (
                        <WifiOff className="h-3 w-3 text-red-400" />
                    )}
                    <Battery className="h-3 w-3 text-yellow-400" />
                    <span className="text-xs text-gray-400">{device.battery}%</span>
                </div>
            </div>
        </div>
    );
};

const PatientMonitor = () => {
    const navigate = useNavigate();
    const { patientId } = useParams<{ patientId: string }>();
    const { toast } = useToast();

    // Fetch patient data
    const { data: patientData, isLoading, error } = useQuery({
        queryKey: ['patient-monitor', patientId],
        queryFn: () => patientId ? apiService.getPatient(patientId) : Promise.reject('No patient ID'),
        refetchInterval: 3000, // Real-time updates every 3 seconds
    });

    // Use measurements from patient data instead of fetching separately
    const measurementsData = patientData?.patient?.devices?.reduce((acc, device) => {
        acc[device.id] = device.latestMeasurements || [];
        return acc;
    }, {} as { [deviceId: string]: Measurement[] }) || {};

    const handleBack = () => {
        navigate('/patients');
    };

    if (isLoading) {
        return (
            <MobileAppContainer>
                <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-gray-400">Loading patient monitor...</p>
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
                            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-red-400 mb-2">Patient Not Found</h2>
                            <p className="text-gray-300 mb-4">Unable to load patient monitoring data</p>
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
    const measurements = measurementsData || {};

    return (
        <MobileAppContainer>
            <div className="bg-[#101010] min-h-screen text-white p-4 font-inter">
                <div className="max-w-sm mx-auto">
                    {/* Status Bar Spacing */}
                    <div className="h-6"></div>

                    {/* Header */}
                    <header className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                                onClick={handleBack}
                                className="bg-gray-700/80 hover:bg-gray-600 p-2 rounded-lg transition-all duration-200 flex-shrink-0"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-bold truncate">{patient.name}</h1>
                                <p className="text-sm text-gray-400 truncate">Live Monitoring</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-xs text-green-400">LIVE</span>
                            </div>
                            <button
                                onClick={() => navigate(`/patient/${patientId}/devices`)}
                                className="bg-blue-500/80 hover:bg-blue-600 p-2 rounded-lg transition-all duration-200"
                                title="Device Details"
                            >
                                <Wrench size={20} />
                            </button>
                            <button className="bg-gray-700/80 hover:bg-gray-600 p-2 rounded-lg transition-all duration-200">
                                <Settings size={20} />
                            </button>
                        </div>
                    </header>

                    {/* Patient Info Header */}
                    <div className="bg-[#1E1E1E] rounded-2xl p-5 mb-6 border border-gray-700/50">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-500/20 p-4 rounded-full">
                                <User className="h-8 w-8 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-bold text-white text-lg truncate">{patient.name}</h2>
                                <p className="text-gray-400 text-sm truncate">Age: {patient.age} • {patient.condition}</p>
                                <div className="flex items-center gap-4 mt-2">
                                    <div className="flex items-center gap-1">
                                        <Activity className="h-4 w-4 text-green-400" />
                                        <span className="text-xs text-green-400">Monitoring Active</span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Updated {new Date().toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Real-time Vital Signs */}
                    <div className="space-y-4 mb-8">
                        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <Activity className="h-5 w-5 text-green-400" />
                            Live Vital Signs
                        </h2>

                        {devices.map((device) => (
                            <VitalCard
                                key={device.id}
                                device={device}
                                measurements={measurements[device.id] || []}
                            />
                        ))}
                    </div>

                    <div className="pb-8"></div>
                </div>
            </div>
        </MobileAppContainer>
    );
};

export default PatientMonitor;