import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { wellueSDK, WellueDevice, WellueSDKCallbacks } from '../lib/wellue-sdk-bridge';

interface DeviceContextType {
    // Device state
    connectedDevice: WellueDevice | null;
    availableDevices: WellueDevice[];
    isScanning: boolean;
    isConnecting: boolean;
    isInitialized: boolean;
    bluetoothEnabled: boolean;
    error: string | null;
    
    // Actions
    startScan: () => Promise<void>;
    stopScan: () => Promise<void>;
    connectToDevice: (device: WellueDevice) => Promise<void>;
    disconnectDevice: () => Promise<void>;
    refreshBattery: () => Promise<void>;
    manualInitializeSDK: () => Promise<void>;
    requestPermissions: () => Promise<void>;
    
    // SDK methods
    startBPMeasurement: () => Promise<void>;
    startECGMeasurement: () => Promise<void>;
    stopMeasurement: () => Promise<void>;
    
    // SDK instance
    wellueSDK: typeof wellueSDK;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const useDevice = () => {
    const context = useContext(DeviceContext);
    if (context === undefined) {
        throw new Error('useDevice must be used within a DeviceProvider');
    }
    return context;
};

interface DeviceProviderProps {
    children: ReactNode;
}

export const DeviceProvider: React.FC<DeviceProviderProps> = ({ children }) => {
    const [connectedDevice, setConnectedDevice] = useState<WellueDevice | null>(null);
    const [availableDevices, setAvailableDevices] = useState<WellueDevice[]>([]);
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [isConnecting, setIsConnecting] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [bluetoothEnabled, setBluetoothEnabled] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize SDK and set up callbacks
    useEffect(() => {
        const initializeSDK = async () => {
            try {
                console.log('🚀 DeviceContext: Starting SDK initialization...');
                console.log('🔍 DeviceContext: SDK initialized status:', wellueSDK.getInitialized());
                console.log('🔍 DeviceContext: Is native platform:', wellueSDK.isNativePlatform());
                
                if (!wellueSDK.getInitialized() && wellueSDK.isNativePlatform()) {
                    console.log('🚀 App launched - requesting permissions and initializing SDK...');
                    
                    // First, request permissions proactively
                    await requestPermissions();
                    
                    // Set up callbacks for device events
                    const callbacks: WellueSDKCallbacks = {
                        onDeviceFound: (device: WellueDevice) => {
                            console.log('🔍 Device found:', device.name, device.id);
                            setAvailableDevices(prev => {
                                const exists = prev.some(d => d.id === device.id);
                                if (!exists) {
                                    console.log('➕ Adding new device to available devices list');
                                    return [...prev, device];
                                }
                                return prev;
                            });
                        },
                        onDeviceConnected: (device: WellueDevice) => {
                            console.log('✅ Device connected:', device.name, device.id);
                            setConnectedDevice(device);
                            setError(null);
                            setIsConnecting(false);
                            
                            // Update the device in available devices list
                            setAvailableDevices(prev => 
                                prev.map(d => d.id === device.id ? { ...d, isConnected: true } : d)
                            );
                            
                            // Save device ID to localStorage for auto-reconnection
                            localStorage.setItem('lastConnectedDevice', device.id);
                            console.log('💾 Saved device ID to localStorage for auto-reconnection:', device.id);
                        },
                        onDeviceDisconnected: (deviceId: string) => {
                            console.log('🔌 Device disconnected:', deviceId);
                            if (connectedDevice?.id === deviceId) {
                                console.log('🔌 Connected device disconnected, updating status...');
                                setConnectedDevice(null);
                                setError('Device disconnected');
                                
                                // Clear the last connected device from storage since it's no longer connected
                                localStorage.removeItem('lastConnectedDevice');
                            }
                            
                            // Update the device in available devices list
                            setAvailableDevices(prev => 
                                prev.map(d => d.id === deviceId ? { ...d, isConnected: false } : d)
                            );
                        },
                        onBatteryUpdate: (deviceId: string, battery: number) => {
                            if (connectedDevice?.id === deviceId) {
                                setConnectedDevice(prev => prev ? { ...prev, battery } : null);
                            }
                            
                            // Update battery in available devices list
                            setAvailableDevices(prev => 
                                prev.map(d => d.id === deviceId ? { ...d, battery } : d)
                            );
                        },
                        onBluetoothStatusChanged: (enabled: boolean) => {
                            console.log('📱 Bluetooth status changed:', enabled);
                            setBluetoothEnabled(enabled);
                            if (!enabled) {
                                setError('Bluetooth is disabled');
                                setConnectedDevice(null);
                                // Clear available devices when Bluetooth is disabled
                                setAvailableDevices([]);
                            }
                        },
                        onError: (error: string, details?: any) => {
                            console.error('Wellue SDK Error:', error, details);
                            setError(error);
                        }
                    };

                    // The SDK should already be initialized from requestPermissions, but let's verify
                    if (!wellueSDK.getInitialized()) {
                        console.log('🔄 DeviceContext: Initializing SDK with callbacks...');
                        await wellueSDK.initialize(callbacks);
                        console.log('✅ Wellue SDK initialized successfully');
                    } else {
                        console.log('✅ SDK already initialized from permission request');
                    }
                    
                    setIsInitialized(true);
                    console.log('✅ DeviceContext: SDK initialization complete');
                    
                    // Check initial Bluetooth status and connected devices
                    try {
                        console.log('🔍 DeviceContext: Checking initial device status...');
                        const connected = await wellueSDK.getConnectedDevices();
                        console.log('🔍 DeviceContext: Initial connected devices:', connected);
                        
                        if (connected && connected.length > 0) {
                            console.log('🔍 Found previously connected device, auto-connecting...');
                            setConnectedDevice(connected[0]);
                        } else {
                            // Try to connect to last known device from storage
                            console.log('🔍 No connected devices, checking for last known device...');
                            const lastDeviceId = localStorage.getItem('lastConnectedDevice');
                            if (lastDeviceId) {
                                console.log('🔄 Attempting to reconnect to last known device:', lastDeviceId);
                                // Start scan to find the last known device
                                try {
                                    await wellueSDK.startScan();
                                    // Wait a bit for devices to be found
                                    setTimeout(async () => {
                                        try {
                                            await wellueSDK.stopScan();
                                            // Check if we found the last known device
                                            const lastDevice = availableDevices.find(d => d.id === lastDeviceId);
                                            if (lastDevice) {
                                                console.log('🎯 Found last known device, attempting connection...');
                                                await connectToDevice(lastDevice);
                                                console.log('✅ Auto-reconnection to last known device successful');
                                            } else {
                                                console.log('⚠️ Last known device not found in scan, trying direct connection...');
                                                // Try to connect directly using the stored ID
                                                try {
                                                    await wellueSDK.connect(lastDeviceId);
                                                    console.log('✅ Direct connection to last known device successful');
                                                } catch (directError) {
                                                    console.log('❌ Direct connection failed:', directError);
                                                }
                                            }
                                        } catch (error) {
                                            console.log('❌ Auto-reconnection scan failed:', error);
                                        }
                                    }, 3000); // Wait 3 seconds for scan
                                } catch (error) {
                                    console.log('❌ Could not start scan for auto-reconnection:', error);
                                }
                            } else {
                                // No last known device, start a scan to discover available devices
                                console.log('🔍 No last known device, starting discovery scan...');
                                try {
                                    await wellueSDK.startScan();
                                    setTimeout(async () => {
                                        try {
                                            await wellueSDK.stopScan();
                                            console.log('🔍 Discovery scan complete, found devices:', availableDevices.length);
                                        } catch (error) {
                                            console.log('❌ Discovery scan failed:', error);
                                        }
                                    }, 5000); // Scan for 5 seconds to discover devices
                                } catch (error) {
                                    console.log('❌ Could not start discovery scan:', error);
                                }
                            }
                        }
                    } catch (e) {
                        console.log('No devices initially connected');
                    }
                } else {
                    console.log('⚠️ DeviceContext: SDK already initialized or not on native platform');
                }
            } catch (error) {
                console.error('Failed to initialize Wellue SDK:', error);
                setError(`Failed to initialize SDK: ${error}`);
            }
        };

        initializeSDK();
    }, []);

    // Improved connection health check with better disconnection detection
    useEffect(() => {
        if (!isInitialized || !connectedDevice) return;

        const healthCheckInterval = setInterval(async () => {
            try {
                // Check if the device is still connected by attempting to get its status
                const connectedDevices = await wellueSDK.getConnectedDevices();
                const isStillConnected = connectedDevices.some(device => device.id === connectedDevice.id);
                
                if (!isStillConnected) {
                    console.log('🔍 Health check: Device no longer connected, updating status...');
                    setConnectedDevice(null);
                    setError('Device disconnected');
                    localStorage.removeItem('lastConnectedDevice');
                    
                    // Update available devices list
                    setAvailableDevices(prev => 
                        prev.map(d => d.id === connectedDevice.id ? { ...d, isConnected: false } : d)
                    );
                } else {
                    // Device is still connected, try to get battery level to verify connection
                    try {
                        await wellueSDK.getBatteryLevel(connectedDevice.id);
                    } catch (batteryError) {
                        // If battery check fails, device might be disconnected
                        console.log('🔍 Battery check failed, device might be disconnected:', batteryError);
                        setConnectedDevice(null);
                        setError('Device connection lost');
                        localStorage.removeItem('lastConnectedDevice');
                        
                        setAvailableDevices(prev => 
                            prev.map(d => d.id === connectedDevice.id ? { ...d, isConnected: false } : d)
                        );
                    }
                }
            } catch (error) {
                console.log('🔍 Health check failed:', error);
                // If health check fails, assume device might be disconnected
                setConnectedDevice(null);
                setError('Device connection lost');
                localStorage.removeItem('lastConnectedDevice');
            }
        }, 10000); // Check every 10 seconds instead of 5 to be less aggressive

        return () => clearInterval(healthCheckInterval);
    }, [isInitialized, connectedDevice, wellueSDK]);

    const startScan = async () => {
        try {
            setIsScanning(true);
            setError(null);
            
            // Clear previous devices list when starting a new scan
            setAvailableDevices([]);
            
            // If SDK is not initialized, try to initialize it first (this will trigger permission requests)
            if (!isInitialized) {
                console.log('🔄 SDK not initialized, attempting to initialize...');
                try {
                    await wellueSDK.initialize({
                        onDeviceFound: (device: WellueDevice) => {
                            console.log('🔍 Device found during scan:', device.name, device.id);
                            setAvailableDevices(prev => {
                                const exists = prev.some(d => d.id === device.id);
                                if (!exists) {
                                    console.log('➕ Adding new device to available devices list');
                                    return [...prev, device];
                                }
                                return prev;
                            });
                        },
                        onDeviceConnected: (device: WellueDevice) => {
                            console.log('✅ Device connected during scan:', device.name, device.id);
                            setConnectedDevice(device);
                            setError(null);
                            setIsConnecting(false);
                            setAvailableDevices(prev => 
                                prev.map(d => d.id === device.id ? { ...d, isConnected: true } : d)
                            );
                            
                            // Save device ID to localStorage for auto-reconnection
                            localStorage.setItem('lastConnectedDevice', device.id);
                            console.log('💾 Saved device ID to localStorage for auto-reconnection:', device.id);
                        },
                        onDeviceDisconnected: (deviceId: string) => {
                            console.log('🔌 Device disconnected during scan:', deviceId);
                            if (connectedDevice?.id === deviceId) {
                                setConnectedDevice(null);
                            }
                            setAvailableDevices(prev => 
                                prev.map(d => d.id === deviceId ? { ...d, isConnected: false } : d)
                            );
                        },
                        onBatteryUpdate: (deviceId: string, battery: number) => {
                            if (connectedDevice?.id === deviceId) {
                                setConnectedDevice(prev => prev ? { ...prev, battery } : null);
                            }
                            setAvailableDevices(prev => 
                                prev.map(d => d.id === deviceId ? { ...d, battery } : d)
                            );
                        },
                        onBluetoothStatusChanged: (enabled: boolean) => {
                            console.log('📱 Bluetooth status changed during scan:', enabled);
                            setBluetoothEnabled(enabled);
                            if (!enabled) {
                                setError('Bluetooth is disabled');
                                setConnectedDevice(null);
                                setAvailableDevices([]);
                            }
                        },
                        onError: (error: string, details?: any) => {
                            console.error('Wellue SDK Error during scan:', error, details);
                            setError(error);
                        }
                    });
                    setIsInitialized(true);
                    console.log('✅ SDK initialized during scan start');
                } catch (initError: any) {
                    console.error('❌ Failed to initialize SDK during scan:', initError);
                    setError(`Failed to initialize SDK: ${initError.message || initError}`);
                    setIsScanning(false);
                    return;
                }
            }
            
            await wellueSDK.startScan();
        } catch (error) {
            console.error('Failed to start scan:', error);
            setError(`Failed to start scan: ${error}`);
            setIsScanning(false);
        }
    };

    const stopScan = async () => {
        try {
            await wellueSDK.stopScan();
            setIsScanning(false);
        } catch (error) {
            console.error('Failed to stop scan:', error);
        }
    };

    const connectToDevice = async (device: WellueDevice) => {
        try {
            setIsConnecting(true);
            setError(null);
            
            // If SDK is not initialized, try to initialize it first
            if (!isInitialized) {
                console.log('🔄 SDK not initialized, attempting to initialize...');
                try {
                    await wellueSDK.initialize({
                        onDeviceFound: (device: WellueDevice) => {
                            setAvailableDevices(prev => {
                                const exists = prev.some(d => d.id === device.id);
                                if (!exists) {
                                    return [...prev, device];
                                }
                                return prev;
                            });
                        },
                        onDeviceConnected: (device: WellueDevice) => {
                            setConnectedDevice(device);
                            setError(null);
                            setIsConnecting(false);
                            setAvailableDevices(prev => 
                                prev.map(d => d.id === device.id ? { ...d, isConnected: true } : d)
                            );
                        },
                        onDeviceDisconnected: (deviceId: string) => {
                            if (connectedDevice?.id === deviceId) {
                                setConnectedDevice(null);
                            }
                            setAvailableDevices(prev => 
                                prev.map(d => d.id === deviceId ? { ...d, isConnected: false } : d)
                            );
                        },
                        onBatteryUpdate: (deviceId: string, battery: number) => {
                            if (connectedDevice?.id === deviceId) {
                                setConnectedDevice(prev => prev ? { ...prev, battery } : null);
                            }
                            setAvailableDevices(prev => 
                                prev.map(d => d.id === deviceId ? { ...d, battery } : d)
                            );
                        },
                        onBluetoothStatusChanged: (enabled: boolean) => {
                            setBluetoothEnabled(enabled);
                            if (!enabled) {
                                setError('Bluetooth is disabled');
                                setConnectedDevice(null);
                                setAvailableDevices([]);
                            }
                        },
                        onError: (error: string, details?: any) => {
                            console.error('Wellue SDK Error during connect:', error, details);
                            setError(error);
                        }
                    });
                    setIsInitialized(true);
                    console.log('✅ SDK initialized during connect');
                } catch (initError: any) {
                    console.error('❌ Failed to initialize SDK during connect:', initError);
                    setError(`Failed to initialize SDK: ${initError.message || initError}`);
                    setIsConnecting(false);
                    return;
                }
            }
            
            console.log('🔗 Attempting to connect to device:', device.name, device.id);
            await wellueSDK.connect(device.id);
        } catch (error) {
            console.error('Failed to connect:', error);
            setError(`Failed to connect: ${error}`);
            setIsConnecting(false);
        }
    };

    const disconnectDevice = async () => {
        if (!connectedDevice) return;
        
        try {
            console.log('🔌 Manually disconnecting device:', connectedDevice.name, connectedDevice.id);
            await wellueSDK.disconnect(connectedDevice.id);
            setConnectedDevice(null);
            localStorage.removeItem('lastConnectedDevice');
            
            // Update available devices list
            setAvailableDevices(prev => 
                prev.map(d => d.id === connectedDevice.id ? { ...d, isConnected: false } : d)
            );
        } catch (error) {
            setError(`Failed to disconnect: ${error}`);
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

    const startBPMeasurement = async () => {
        if (!connectedDevice) {
            setError('No device connected');
            return;
        }
        
        try {
            await wellueSDK.startBPMeasurement(connectedDevice.id);
        } catch (error) {
            setError(`Failed to start BP measurement: ${error}`);
        }
    };

    const startECGMeasurement = async () => {
        if (!connectedDevice) {
            setError('No device connected');
            return;
        }
        
        try {
            await wellueSDK.startECGMeasurement(connectedDevice.id);
        } catch (error) {
            setError(`Failed to start ECG measurement: ${error}`);
        }
    };

    const stopMeasurement = async () => {
        if (!connectedDevice) return;
        
        try {
            await wellueSDK.stopLive(connectedDevice.id);
        } catch (error) {
            setError(`Failed to stop measurement: ${error}`);
        }
    };

    const manualInitializeSDK = async () => {
        try {
            setError(null);
            console.log('🔄 Manual SDK initialization requested...');
            
            const callbacks: WellueSDKCallbacks = {
                onDeviceFound: (device: WellueDevice) => {
                    setAvailableDevices(prev => {
                        const exists = prev.some(d => d.id === device.id);
                        if (!exists) {
                            return [...prev, device];
                        }
                        return prev;
                    });
                },
                onDeviceConnected: (device: WellueDevice) => {
                    setConnectedDevice(device);
                    setError(null);
                    setIsConnecting(false);
                    setAvailableDevices(prev => 
                        prev.map(d => d.id === device.id ? { ...d, isConnected: true } : d)
                    );
                    
                    // Save device ID to localStorage for auto-reconnection
                    localStorage.setItem('lastConnectedDevice', device.id);
                    console.log('💾 Saved device ID to localStorage for auto-reconnection:', device.id);
                },
                onDeviceDisconnected: (deviceId: string) => {
                    console.log('🔌 Device disconnected during manual init, attempting auto-reconnection...');
                    if (connectedDevice?.id === deviceId) {
                        setConnectedDevice(null);
                        
                        // Attempt auto-reconnection after a short delay
                        setTimeout(async () => {
                            try {
                                console.log('🔄 Attempting auto-reconnection to device:', deviceId);
                                const device = availableDevices.find(d => d.id === deviceId);
                                if (device) {
                                    await connectToDevice(device);
                                    console.log('✅ Auto-reconnection successful');
                                }
                            } catch (error) {
                                console.log('❌ Auto-reconnection failed:', error);
                            }
                        }, 2000); // Wait 2 seconds before attempting reconnection
                    }
                    setAvailableDevices(prev => 
                        prev.map(d => d.id === deviceId ? { ...d, isConnected: false } : d)
                    );
                },
                onBatteryUpdate: (deviceId: string, battery: number) => {
                    if (connectedDevice?.id === deviceId) {
                        setConnectedDevice(prev => prev ? { ...prev, battery } : null);
                    }
                    setAvailableDevices(prev => 
                        prev.map(d => d.id === deviceId ? { ...d, battery } : d)
                    );
                },
                onBluetoothStatusChanged: (enabled: boolean) => {
                    setBluetoothEnabled(enabled);
                    if (!enabled) {
                        setError('Bluetooth is disabled');
                        setConnectedDevice(null);
                        setAvailableDevices([]);
                    }
                },
                onError: (error: string, details?: any) => {
                    console.error('Wellue SDK Error during manual init:', error, details);
                    setError(error);
                }
            };

            await wellueSDK.initialize(callbacks);
            setIsInitialized(true);
            console.log('✅ Manual SDK initialization successful');
        } catch (error: any) {
            console.error('❌ Manual SDK initialization failed:', error);
            setError(`Failed to initialize SDK: ${error.message || error}`);
        }
    };

    const requestPermissions = async () => {
        try {
            setError(null);
            console.log('🔐 Requesting Bluetooth permissions...');
            
            // This will trigger the native plugin's permission request
            await wellueSDK.initialize({
                onDeviceFound: (device: WellueDevice) => {
                    setAvailableDevices(prev => {
                        const exists = prev.some(d => d.id === device.id);
                        if (!exists) {
                            return [...prev, device];
                        }
                        return prev;
                    });
                },
                onDeviceConnected: (device: WellueDevice) => {
                    setConnectedDevice(device);
                    setError(null);
                    setIsConnecting(false);
                    setAvailableDevices(prev => 
                        prev.map(d => d.id === device.id ? { ...d, isConnected: true } : d)
                    );
                },
                onDeviceDisconnected: (deviceId: string) => {
                    if (connectedDevice?.id === deviceId) {
                        setConnectedDevice(null);
                    }
                    setAvailableDevices(prev => 
                        prev.map(d => d.id === deviceId ? { ...d, isConnected: false } : d)
                    );
                },
                onBatteryUpdate: (deviceId: string, battery: number) => {
                    if (connectedDevice?.id === deviceId) {
                        setConnectedDevice(prev => prev ? { ...prev, battery } : null);
                    }
                    setAvailableDevices(prev => 
                        prev.map(d => d.id === deviceId ? { ...d, battery } : d)
                    );
                },
                onBluetoothStatusChanged: (enabled: boolean) => {
                    setBluetoothEnabled(enabled);
                    if (!enabled) {
                        setError('Bluetooth is disabled');
                        setConnectedDevice(null);
                        setAvailableDevices([]);
                    }
                },
                onError: (error: string, details?: any) => {
                    console.error('Wellue SDK Error during permission request:', error, details);
                    setError(error);
                }
            });
            
            // If we get here, permissions were granted
            setIsInitialized(true);
            console.log('✅ Permissions granted and SDK initialized successfully');
        } catch (error: any) {
            if (error.message && error.message.includes('permission')) {
                console.log('⚠️ Permission request pending - user needs to grant permissions');
                setError('Please grant Bluetooth permissions when prompted to use this app');
            } else {
                console.error('❌ Permission request failed:', error);
                setError(`Failed to request permissions: ${error.message || error}`);
            }
        }
    };

    const value: DeviceContextType = {
        connectedDevice,
        availableDevices,
        isScanning,
        isConnecting,
        isInitialized,
        bluetoothEnabled,
        error,
        startScan,
        stopScan,
        connectToDevice,
        disconnectDevice,
        refreshBattery,
        manualInitializeSDK,
        requestPermissions,
        startBPMeasurement,
        startECGMeasurement,
        stopMeasurement,
        wellueSDK
    };

    return (
        <DeviceContext.Provider value={value}>
            {children}
        </DeviceContext.Provider>
    );
};
