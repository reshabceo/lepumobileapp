import React, { useState, useEffect } from 'react';
import { Bp2, getEcgDataInMv } from '@/plugins/bp2';
import EcgChartWithControls from './EcgChartWithControls';
import { useDevice } from '@/contexts/DeviceContext';
import { useToast } from '@/hooks/use-toast';
import { Bluetooth, BluetoothOff, Loader2, AlertCircle, CheckCircle, Activity } from 'lucide-react';

export default function EcgResultScreen() {
    const [ecg, setEcg] = useState<{s: Float32Array, sr: number, scale: number} | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [records, setRecords] = useState<string[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<string[]>([]);
    const [nonEcgFiles, setNonEcgFiles] = useState<Set<string>>(new Set());
    
    // Use the same device context as the dashboard
    const {
        connectedDevice,
        bluetoothEnabled,
        isInitialized,
        error: deviceError,
    } = useDevice();
    
    const { toast } = useToast();

    // Auto-load ECG records when device is connected
    useEffect(() => {
        if (connectedDevice?.id && isInitialized) {
            loadEcgRecords();
        }
    }, [connectedDevice, isInitialized]);

    async function loadEcgRecords() {
        try {
            if (!connectedDevice?.id) {
                setError('No device connected. Please connect your BP2 device from the dashboard first.');
                setRecords([]);
                setFilteredRecords([]);
                return;
            }

            if (!isInitialized) {
                setError('Device SDK not initialized. Please wait or reconnect your device.');
                return;
            }

            setLoading(true);
            setError(null);
            
            // Use the Bp2Plugin to get ECG records
            const result = await Bp2.listEcgRecords();
            const allRecords = result.records || [];
            
            setRecords(allRecords);
            
            // Initially show all records, filtering will happen on read attempt
            setFilteredRecords(allRecords);
            
            if (allRecords.length === 0) {
                setError('No files found on this device. Please record some measurements first.');
            } else {
                setError(null);
                toast({
                    title: 'Records Loaded',
                    description: `Found ${allRecords.length} files on device`,
                });
            }
        } catch (err) {
            console.error('Failed to load ECG records:', err);
            setError(`Failed to load ECG records: ${err}`);
            setRecords([]);
            setFilteredRecords([]);
        } finally {
            setLoading(false);
        }
    }

    async function loadAndRenderEcg(recordId: string) {
        try {
            if (!connectedDevice?.id) {
                setError('No device connected. Please connect your BP2 device first.');
                return;
            }

            setLoading(true);
            setError(null);
            
            // Use the Bp2Plugin to read ECG record
            const result = await Bp2.getEcgRecord({ recordId });
            
            // Convert to mV format using our helper
            const ecgData = getEcgDataInMv(result);
            
            setEcg({ 
                s: ecgData.samples, 
                sr: ecgData.sampleRate, 
                scale: 1.0 // Already in mV, no scaling needed
            });
            
            toast({
                title: 'ECG Loaded Successfully',
                description: `Loaded ${ecgData.samples.length} samples at ${ecgData.sampleRate} Hz`,
            });
            
            // Mark this file as successfully read ECG
            setNonEcgFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(recordId);
                return newSet;
            });
            
        } catch (err) {
            console.error('Failed to load ECG record:', err);
            
            // Check if this is a "Not an ECG file" error
            if (err.toString().includes('Not an ECG file')) {
                setNonEcgFiles(prev => new Set([...prev, recordId]));
                setError(`File ${recordId} is not an ECG file. It may be a blood pressure reading.`);
            } else {
                setError(`Failed to load ECG record: ${err}`);
            }
        } finally {
            setLoading(false);
        }
    }



    // Filter records to show ONLY ECG files, hide BP files completely
    useEffect(() => {
        const ecgFiles = records.filter(record => !nonEcgFiles.has(record));
        setFilteredRecords(ecgFiles); // Only show ECG files, completely hide BP files
    }, [records, nonEcgFiles]);

    // Device connection status component
    const DeviceStatus = () => {
        if (!bluetoothEnabled) {
            return (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <BluetoothOff className="h-5 w-5 text-red-400" />
                        <div>
                            <h3 className="font-semibold text-red-300">Bluetooth Disabled</h3>
                            <p className="text-red-400 text-sm">Please enable Bluetooth to connect to your BP2 device</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (!isInitialized) {
            return (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />
                        <div>
                            <h3 className="font-semibold text-yellow-300">Initializing Device SDK</h3>
                            <p className="text-yellow-400 text-sm">Please wait while we initialize the device connection...</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (!connectedDevice) {
            return (
                <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-400" />
                        <div>
                            <h3 className="font-semibold text-orange-300">No Device Connected</h3>
                            <p className="text-orange-400 text-sm">
                                Please connect your BP2 device from the dashboard first, then return here to view ECG records.
                            </p>
                            <button
                                onClick={() => window.history.back()}
                                className="mt-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                            >
                                Go Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <div>
                        <h3 className="font-semibold text-green-300">Device Connected</h3>
                        <p className="text-green-400 text-sm">
                            Connected to: <strong className="text-green-200">{connectedDevice.name}</strong> ({connectedDevice.model})
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto bg-[#101010] min-h-screen">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-white mb-2">ECG Results</h1>
                <p className="text-gray-300">View and export ECG recordings from your Lepu BP2 device</p>
            </div>

            {/* Device Status */}
            <DeviceStatus />

            {/* ECG Records List - Only show if device is connected */}
            {connectedDevice && isInitialized && (
                <div className="bg-gray-800/50 rounded-lg shadow-md p-6 border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-white">ECG Records Only</h2>
                        <button 
                            onClick={loadEcgRecords}
                            disabled={loading}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <Bluetooth className="h-4 w-4" />
                                    Refresh Records
                                </>
                            )}
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
                            <p className="text-red-300">{error}</p>
                        </div>
                    )}

                    {filteredRecords.length > 0 ? (
                        <div className="grid gap-3">
                            {filteredRecords.map((record, index) => (
                                <div 
                                    key={index}
                                    className="flex justify-between items-center p-3 border border-gray-700 rounded-lg hover:bg-gray-700 bg-gray-800/30"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-sm text-gray-300">{record}</span>
                                        <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded border border-green-700">
                                            ECG File
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => loadAndRenderEcg(record)}
                                        disabled={loading}
                                        className="px-3 py-1 text-sm rounded transition-colors bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                    >
                                        View ECG
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-center py-8">
                            {loading ? 'Loading ECG records...' : 'No ECG records found. Click "Refresh Records" to scan your device.'}
                        </p>
                    )}
                </div>
            )}

            {/* ECG Chart Display with Controls */}
            {ecg && (
                <EcgChartWithControls 
                    ecgData={ecg}
                />
            )}

            {/* Technical Information */}
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-3 text-white">Technical Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                    <div>
                        <p><strong className="text-green-400">Sample Rate:</strong> 125 Hz (fixed)</p>
                        <p><strong className="text-green-400">Scale Factor:</strong> 3.098 μV/LSB</p>
                        <p><strong className="text-green-400">Data Format:</strong> Int16 array or Float32 (mV)</p>
                    </div>
                    <div>
                        <p><strong className="text-green-400">Voltage Range:</strong> ±2 mV</p>
                        <p><strong className="text-green-400">Grid Size:</strong> 5mm major, 1mm minor</p>
                        <p><strong className="text-green-400">Export Format:</strong> PNG with medical grid</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
