import { useState, useEffect } from 'react';
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

export interface Measurement {
    id: string;
    deviceId: string;
    timestamp: string;
    type: string;
    [key: string]: any;
}

export interface HealthMetric {
    id: string;
    name: string;
    value: string;
    unit: string;
    status: 'Normal' | 'High' | 'Low' | 'Critical';
    color: string;
    deviceId?: string;
    timestamp?: string;
    chartData: number[];
}

export interface HealthData {
    devices: Device[];
    metrics: HealthMetric[];
    loading: boolean;
    error: string | null;
}

export const useHealthData = (): HealthData => {
    const [healthData, setHealthData] = useState<HealthData>({
        devices: [],
        metrics: [],
        loading: true,
        error: null,
    });

    // Real device detection - no mock data
    useEffect(() => {
        // Initialize with empty state - real devices will be detected by Wellue SDK
        setHealthData({
            devices: [],
            metrics: [],
            loading: false,
            error: null,
        });
    }, []);

    // Disable real API calls for now - we'll use native SDK instead
    const { data: devicesData, error: devicesError, isLoading: devicesLoading } = useQuery({
        queryKey: ['devices'],
        queryFn: () => Promise.resolve({ devices: [], count: 0 }),
        refetchInterval: false, // Disable refetching
        enabled: false, // Disable the query - we'll use native SDK
    });

    // Helper function to determine status and color based on values
    const getStatusAndColor = (type: string, value: number | string): { status: HealthMetric['status'], color: string } => {
        switch (type) {
            case 'BP':
                const [systolic, diastolic] = String(value).split('/').map(Number);
                if (systolic >= 140 || diastolic >= 90) {
                    return { status: 'High', color: '#F87171' };
                } else if (systolic < 90 || diastolic < 60) {
                    return { status: 'Low', color: '#FCD34D' };
                } else {
                    return { status: 'Normal', color: '#34D399' };
                }

            case 'ECG':
                const heartRate = Number(value);
                if (heartRate > 100) {
                    return { status: 'High', color: '#F87171' };
                } else if (heartRate < 60) {
                    return { status: 'Low', color: '#FCD34D' };
                } else {
                    return { status: 'Normal', color: '#34D399' };
                }

            case 'OXIMETER':
                const spo2 = Number(value);
                if (spo2 < 90) {
                    return { status: 'Critical', color: '#DC2626' };
                } else if (spo2 < 95) {
                    return { status: 'Low', color: '#F87171' };
                } else {
                    return { status: 'Normal', color: '#34D399' };
                }

            case 'GLUCOSE':
                const glucose = Number(value);
                if (glucose > 180) {
                    return { status: 'High', color: '#F87171' };
                } else if (glucose < 70) {
                    return { status: 'Low', color: '#FCD34D' };
                } else {
                    return { status: 'Normal', color: '#34D399' };
                }

            default:
                return { status: 'Normal', color: '#34D399' };
        }
    };

    // Handle loading and error states
    useEffect(() => {
        if (devicesLoading) {
            setHealthData(prev => ({ ...prev, loading: true, error: null }));
        } else if (devicesError) {
            setHealthData(prev => ({
                ...prev,
                loading: false,
                error: devicesError instanceof Error ? devicesError.message : 'Failed to fetch devices',
            }));
        }
    }, [devicesLoading, devicesError]);

    return healthData;
};