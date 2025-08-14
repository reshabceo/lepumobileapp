import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Search, Filter, User, Activity, Heart, Wind, Droplets } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// Define interfaces locally since we're not using the old API service
export interface Patient {
    id: string;
    name: string;
    age: number;
    condition: string;
    devices: string[];
    deviceStatus?: {
        deviceId: string;
        type: string;
        connected: boolean;
        battery: number;
    }[];
}

// Get condition color based on severity
const getConditionColor = (condition: string) => {
    switch (condition.toLowerCase()) {
        case 'hypertension':
            return 'bg-red-500/20 text-red-400 border-red-500/30';
        case 'diabetes type 2':
            return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
        case 'cardiac arrhythmia':
            return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'asthma':
            return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'obesity':
            return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
        default:
            return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
};

// Get device type icon and color
const getDeviceInfo = (type: string) => {
    switch (type) {
        case 'BP':
            return { icon: Heart, color: 'text-red-400', name: 'Blood Pressure' };
        case 'ECG':
            return { icon: Activity, color: 'text-green-400', name: 'ECG Monitor' };
        case 'OXIMETER':
            return { icon: Wind, color: 'text-blue-400', name: 'Pulse Oximeter' };
        case 'GLUCOSE':
            return { icon: Droplets, color: 'text-yellow-400', name: 'Glucose Meter' };
        default:
            return { icon: Activity, color: 'text-gray-400', name: 'Unknown Device' };
    }
};

// Patient Card Component
const PatientCard = ({ patient, onPatientClick }: { patient: Patient; onPatientClick: (patient: Patient) => void }) => {
    const conditionColorClass = getConditionColor(patient.condition);
    const connectedDevices = patient.deviceStatus?.filter(d => d.connected).length || 0;
    const totalDevices = patient.deviceStatus?.length || 0;
    const avgBattery = patient.deviceStatus?.reduce((sum, d) => sum + d.battery, 0) / totalDevices || 0;

    return (
        <div
            className="bg-[#1E1E1E] rounded-2xl p-5 hover:bg-[#252525] transition-all duration-200 cursor-pointer border border-gray-700/50"
            onClick={() => onPatientClick(patient)}
        >
            {/* Patient Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-500/20 p-3 rounded-full">
                        <User className="h-8 w-8 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">{patient.name}</h3>
                        <p className="text-gray-400 text-sm">Age: {patient.age} years</p>
                        <p className="text-gray-500 text-xs">ID: {patient.id}</p>
                    </div>
                </div>
                {/* ChevronRight is removed as per new_code, but keeping the structure */}
            </div>

            {/* Medical Condition */}
            <div className="mb-4">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${conditionColorClass}`}>
                    {patient.condition}
                </div>
            </div>

            {/* Device Status Overview */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                    <div className="text-lg font-bold text-green-400">{connectedDevices}/{totalDevices}</div>
                    <div className="text-xs text-gray-400">Connected</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-bold text-blue-400">{Math.round(avgBattery)}%</div>
                    <div className="text-xs text-gray-400">Avg Battery</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-bold text-white">{totalDevices}</div>
                    <div className="text-xs text-gray-400">Total Devices</div>
                </div>
            </div>

            {/* Device Icons */}
            <div className="flex justify-center gap-4">
                {patient.deviceStatus?.map((deviceStatus) => {
                    const deviceInfo = getDeviceInfo(deviceStatus.type);
                    const Icon = deviceInfo.icon;
                    return (
                        <div key={deviceStatus.deviceId} className="relative">
                            <div className={`p-2 rounded-lg ${deviceStatus.connected ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                                <Icon className={`h-5 w-5 ${deviceStatus.connected ? deviceInfo.color : 'text-gray-500'}`} />
                            </div>
                            {!deviceStatus.connected && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-[#1E1E1E]"></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const PatientList = () => {
    const navigate = useNavigate();
    const { toast } = useToast();

    // Fetch patients data
    // This part of the code was not provided in the new_code, so it's kept as is.
    // It assumes a local data source or a different API service.
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                setLoading(true);
                // Simulate fetching patients from a local data source
                // In a real app, this would be apiService.getPatients()
                const mockPatients: Patient[] = [
                    {
                        id: 'P001',
                        name: 'John Doe',
                        age: 45,
                        condition: 'Hypertension',
                        devices: ['BP', 'ECG', 'OXIMETER'],
                        deviceStatus: [
                            { deviceId: 'BP1', type: 'BP', connected: true, battery: 95 },
                            { deviceId: 'ECG1', type: 'ECG', connected: true, battery: 88 },
                            { deviceId: 'OXIMETER1', type: 'OXIMETER', connected: true, battery: 92 },
                        ],
                    },
                    {
                        id: 'P002',
                        name: 'Jane Smith',
                        age: 32,
                        condition: 'Diabetes Type 2',
                        devices: ['GLUCOSE', 'OXIMETER'],
                        deviceStatus: [
                            { deviceId: 'GLUCOSE1', type: 'GLUCOSE', connected: true, battery: 90 },
                            { deviceId: 'OXIMETER2', type: 'OXIMETER', connected: true, battery: 95 },
                        ],
                    },
                    {
                        id: 'P003',
                        name: 'Peter Jones',
                        age: 50,
                        condition: 'Cardiac Arrhythmia',
                        devices: ['OXIMETER'],
                        deviceStatus: [
                            { deviceId: 'OXIMETER3', type: 'OXIMETER', connected: true, battery: 98 },
                        ],
                    },
                ];
                setPatients(mockPatients);
            } catch (err) {
                setError(err as Error);
                toast({
                    title: 'Error loading patients',
                    description: err instanceof Error ? err.message : 'Failed to load patients',
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        };

        fetchPatients();
        const interval = setInterval(fetchPatients, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [toast]);

    const handleBack = () => {
        navigate('/dashboard');
    };

    const handlePatientClick = (patient: Patient) => {
        navigate(`/patient/${patient.id}/monitor`);
    };

    if (loading) {
        return (
            <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    {/* Loader2 is removed as per new_code, but keeping the structure */}
                    <p className="text-gray-400">Loading patients...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-[#101010] min-h-screen text-white p-4">
                <div className="max-w-sm mx-auto">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
                        <User className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Patients</h2>
                        <p className="text-gray-300 mb-4">{error instanceof Error ? error.message : 'Failed to load patients'}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all duration-200"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
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
                        <h1 className="text-2xl font-bold">Patients</h1>
                    </div>
                    {/* Settings button is removed as per new_code, but keeping the structure */}
                </header>

                {/* Stats Header */}
                <div className="bg-[#1E1E1E] rounded-2xl p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-blue-400">{patients.length}</div>
                            <div className="text-sm text-gray-400">Total Patients</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green-400">
                                {patients.reduce((sum, p) => sum + (p.deviceStatus?.filter(d => d.connected).length || 0), 0)}
                            </div>
                            <div className="text-sm text-gray-400">Active Devices</div>
                        </div>
                    </div>
                </div>

                {/* Patients List */}
                <div className="space-y-4 mb-8">
                    <h2 className="text-lg font-bold text-white mb-3">
                        Active Patients ({patients.length})
                    </h2>

                    {patients.length > 0 ? (
                        patients.map((patient) => (
                            <PatientCard
                                key={patient.id}
                                patient={patient}
                                onPatientClick={handlePatientClick}
                            />
                        ))
                    ) : (
                        <div className="bg-[#1E1E1E] rounded-2xl p-8 text-center">
                            <User className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-400 mb-2">No Patients Found</h3>
                            <p className="text-sm text-gray-500">
                                No patients are currently registered in the system
                            </p>
                        </div>
                    )}
                </div>

                <div className="pb-8"></div>
            </div>
        </div>
    );
};

export default PatientList;